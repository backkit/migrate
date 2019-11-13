const AbstractStorageBackend = require(`${__dirname}/AbstractStorageBackend.js`);

/**
 * Default storage backend
 */
class FileBackend extends AbstractStorageBackend {
  constructor() {
    super()
  }

  async saveIndex(idx, filename) {
    require('fs').writeFileSync('./migration', idx);
  }

  async loadIndex() {
    if (!require('fs').existsSync('./migration')) require('fs').writeFileSync('./migration', 0);
    return parseInt(require('fs').readFileSync('./migration'), 10)
  }
}

module.exports = FileBackend;