const moment = require('moment');
const FileBackend = require(`${__dirname}/backends/FileBackend.js`);
const AbstractStorageBackend = require(`${__dirname}/backends/AbstractStorageBackend.js`);

/**
 * General purpose migration service for backkit
 */
class MigrateService {

  /**
   * @param {String} appdir
   * @param {WinstonService} logger
   * @param {ConfigService} config
   */
  constructor({appdir, logger, config}) {
    this.appdir = appdir;
    this.logger = logger;
    this.migrateConfig = config.get('migrate') || {};
    this.migrations = [];
    this.storageBackends = {};
    this.storage = null;
    this.registerStorageBackend('file', FileBackend);
    this.check();
  }

  /**
   * Checks if required configuration is ok
   */
  check() {
    // new backends might have bee registered since constructor run, mets try to discover it
    this.storage = this.migrateConfig && this.migrateConfig.storage ? new this.storageBackends[this.migrateConfig.storage]() : null;

    // check storage value
    if (!this.storage) {
      throw Error("Please define a storage");
    } else if (!this.storage instanceof AbstractStorageBackend) {
      throw Error("Storage must inherit AbstractStorageBackend");
    } else if (this.storage.saveIndex.constructor.name !== "AsyncFunction") {
      throw Error("Storage's saveIndex must be async");
    } else if (this.storage.loadIndex.constructor.name !== "AsyncFunction") {
      throw Error("Storage's loadIndex must be async");
    }
  }

  /**
   * Register new storage backend
   */
  registerStorageBackend(name, storageBackend) {
    this.storageBackends[name] = storageBackend;
  }

  /**
   * Saves current migration index
   */
  async saveCurentIndex(newStep, filename) {

    this.check()
    await this.storage.saveIndex(newStep, filename)
  }

  /**
   * Retrieves curent migration index
   */
  async getCurentIndex() {

    this.check()
    return await this.storage.loadIndex()
  }

  /**
   * Register new migration
   *
   * @param {Migration} migration
   */
  use(migration) {
    if (!migration.name) throw Error(`migration name is missing`);
    if (!migration.up) throw Error(`up function is required for ${migration.name}`);
    if (!migration.down) throw Error("down function is required for ${migration.name}");
    if (migration.up.constructor.name !== "AsyncFunction") throw Error(`up function must be async in ${migration.name}`);
    if (migration.down.constructor.name !== "AsyncFunction") throw Error(`down function must be async in ${migration.name}`);
    this.migrations.push(migration);
  }


  /**
   * Create new migration file
   */
  async create() {

    this.check()
    const time = moment.utc().format("YYYYMMDD-HHmmss");
    const filePath = process.argv[3] ? `${this.appdir}/res/migrate/${time}-${process.argv[3]}.js` : `${this.appdir}/res/migrate/${time}.js`;
    require('fs').writeFileSync(filePath, `

class Migration {

  constructor({migrate}) {
    this.name = "${process.argv[3]}";
    this.fileName = require('path').basename(__filename);
    migrate.use(this);
  }

  async down() {
    console.log("migrate down ${filePath}")
    this.hh()
  }

  async up() {
    console.log("migrate up ${filePath}")
  }
}

module.exports = Migration;`);
    this.logger.info(`new migration created @${filePath}`)
  }


  /**
   * List migrations as well as curent state
   */
  async list() {

    this.check()
    const migrations = this.migrations;
    let idx = 0;

    let curStep = await this.getCurentIndex();
    this.logger.info(`latest migration run is @${curStep}`)

    for (let el of migrations) {
      let loopStep = ++idx;
      this.logger.info(loopStep > curStep?'[ ]':'[v]', loopStep, el.fileName, loopStep > curStep?'todo':'done')
    }
  }

  /**
   * Migrate up (runs all migrations)
   */
  async up() {

    this.check()
    const migrations = this.migrations;

    let idx = 0;
    let curStep = await this.getCurentIndex();
    this.logger.info(`latest migration run is @${curStep}`)

    for (let el of migrations) {
      let loopStep = ++idx;

      this.logger.info("")
      this.logger.info(loopStep, el.fileName)
      if (loopStep > curStep) {

        // running migration
        await el.up()

        // up succeeded, we now store the result
        //this.logger.info(`saving curent migration index @${loopStep}`)

        await this.saveCurentIndex(loopStep, el.fileName)
        this.logger.info(`updating migration index to @${loopStep}`)
      }
      else {
        this.logger.info(`skiping migration @${loopStep} (already done <= ${curStep})`)
      }
    }
  }

  /**
   * Migrate down (runs one migratioon at a time)
   */
  async down() {

    this.check()
    const migrations = this.migrations;

    let curStep = await this.getCurentIndex();
    let idx = curStep>0?curStep-1:0
    this.logger.info(`latest migration run is @${curStep}`)

    if (curStep > 0) {
      //this.logger.info(curStep, migrations)
      let curMigration = migrations[idx];
      let prevMigration = migrations[idx-1];
      if (curMigration) {
        await curMigration.down()

        // down migration is done, lets update index
        let nextStep = curStep-1
        await this.saveCurentIndex(nextStep, prevMigration?prevMigration.fileName:"")
        this.logger.info(`updating migration index to @${nextStep}`)
      }
      else {
        throw Error("Curent migrataion code is missing")
      }
    }
    else {
      this.logger.info(`no down migration to run`)
    }
  }
  
  /**
   * Start all queue workers
   */
  run() {
    if (process.argv.length >= 3) {
      if (process.argv[2].toLowerCase() === 'up') {
        this.up()
        .then()
        .catch(err => {
          this.logger.error(`Migrate ls failed: ${err.message}`)
        })
      } else if (process.argv[2].toLowerCase() === 'down') {
        this.down()
        .then()
        .catch(err => {
          this.logger.error(`Migrate down failed: ${err.message}`)
        })
      } else if (process.argv[2].toLowerCase() === 'ls') {
        this.list()
        .then()
        .catch(err => {
          this.logger.error(`Migrate up failed: ${err.message}`)
        })
      } else if (process.argv[2].toLowerCase() === 'new') {
        this.create()
        .then()
        .catch(err => {
          this.logger.error(`Migrate new failed: ${err.message}`)
        })
      } else {
        this.logger.error(`Unknown command: ${process.argv[2]}`)
      }
    }
  }

  /**
   * Register all queue processors
   *
   * @return {String}
   */
  register() {
    return `${this.appdir}/res/migrate/*.js`;
  }
}

module.exports = MigrateService;