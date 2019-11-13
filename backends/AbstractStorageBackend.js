
class AbstractStorageBackend 
{
  constructor() {
  }

  async saveIndex(idx, filename) {
    throw Error("saveIndex not implemented")
  }

  async loadIndex() {
    throw Error("loadIndex not implemented")
  }
}

module.exports = AbstractStorageBackend;