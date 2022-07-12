const fs = require('fs');

const file = "./files/scraped_companies.json"
const locationsTxt = "txt-files/locations.txt"
const termsTxt = "txt-files/terms.txt"
let data = JSON.parse(fs.readFileSync(file))
var oldKey = "company"
var newKey = "company_name"

data = renameKey(data, oldKey, newKey)
save(data, file)
//write()
//uniqueIndustires(data)

function uniqueIndustires(data){
  let indus = new Set()
  for (var i=0;i<data.length;i++){
    indus.add(data[i].industry)
  }
  console.log(indus)
}


function renameKey(data, oldKey, newKey) {
  for (let i = 0; i < data.length; i++) {
    let obj = data[i]
    obj[newKey] = obj[oldKey];
    delete obj[oldKey];
  }
  return data
};

function write(){
  const terms = fs.readFileSync(termsTxt).toString().split("\r\n")
  const locations = fs.readFileSync(locationsTxt).toString().split("\r\n")
  let search = {
    terms: [],
    locations: []
  }
  for(var i=0;i<terms.length;i++){
    search.terms.push(terms[i])
  }
  for(var i=0;i<locations.length;i++){
    search.locations.push(locations[i])
  }
  save(search, "json-files/search.json")
}

function save(data, path) {

  let jsonData = JSON.stringify(data);
  fs.writeFile(path, jsonData, function (err) {
    if (err) {
      console.log(err);
    }
  });
};


