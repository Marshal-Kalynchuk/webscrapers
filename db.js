const fs = require('fs')
class DataStore {
  constructor(file_path, model){
    this.file_path = file_path,
    this.model = model
    this.data = JSON.parse(fs.readFileSync(file_path))
  }
  get(obj) {
    
  }
  put(obj) {

  }
  post(obj) {

  }

}