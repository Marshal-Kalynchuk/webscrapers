import fs from 'fs';
//import uuidv4 from 'uuid';
import {EmailBot} from './bots.js';
function uuidv4(){return undefined}

class Company {
  constructor(companyName, industry, location, size, linkedinUrl=undefined, websiteUrl=undefined, phone=undefined, email=undefined, template=undefined){
    this.id = uuidv4(),
    this.company = companyName,
    this.industry = industry,
    this.location = location, 
    this.size = size,
    this.linkedinUrl = linkedinUrl,
    this.websiteUrl = websiteUrl,
    this.phone = phone,
    this.email = email,
    this.template = template
  }
}

class Contact{
  constructor(company, firstName, middleName = undefined, lastName, role, geography, email=undefined, number=undefined) {
    this.id = uuidv4(),
    this.company = company, 
    this.firstName = firstName,
    this.middleName = middleName,
    this.lastName = lastName,
    this.role = role,
    this.email = email,
    this.number = number ,
    this.geography = geography
  }
};

class UrlSet{
  constructor(companyName, linkedinUrl, websiteUrl){
    this.id = uuidv4(),
    this.company = companyName,
    this.linkedinUrl = linkedinUrl,
    this.websiteUrl = websiteUrl
  }
}

/**Takes in a copy pasted text from the linkedin sales navigator 
 * leads list and turns it into a list of contacts objects */
export async function processContacts(txtData){

  console.log("Processing contacts...")
  let contacts = []
  let firstName, middleName, lastName = undefined

  for (var i=0; i<txtData.length; i++) {
    if (txtData[i].includes("Select")){
      var name = txtData[i+2].split(" ")
      firstName = name[0]
      lastName = name[name.length - 1]
      if (name.length == 3){
        middleName = name[1]
      }
    }
    else if (txtData[i].includes("1 List")){
      let contact = new Contact(
        txtData[i+4], // Company Name
        firstName,
        middleName,
        lastName,
        role = txtData[i+2],
        geography = txtData[i+5].split("\t")[0],
      )
      middleName = undefined
      contacts.push(contact)
    }
  }
  console.log("Finished")
  return contacts
};

/**Takes in a list of contacts and tries to generate emails for them */
export async function generateEmails(contacts){

  /**Create Email bot instance */
  const bot = new EmailBot(true)
  await bot.init()

  /**Cycle through list of contacts */
  for (let contact of contacts){
    let format, domain, template = undefined
    if(contact.email == undefined){
      /**TODO - Search database for template */
      if(false){
        /**TODO - Generate email off database template */
      }
      /**Use EmailBot to search for email template */
      else{
        template = await bot.find(contact.company)
        console.log(template)
        if(template != undefined){
          console.log(`Email formate found for: ${contact}`)

          /**Generate email template */
          const split = template.split("@");
          format = split[0]; 
          domain = split[1];

          format = format
          .replace("first_name", contact.firstName)
          .replace("first_initial", contact.firstName[0])
          .replace("last_name", contact.lastName)
          .replace("last_initial", contact.lastName[0])

          contact.email = format + "@" + domain

          /**TODO - Add template to database */
          /**TODO - Update contact database */
        }
        else{
          console.log(`Could not find email format for: ${contact}`)
        }
      }
    }
    
  }
  return contacts
};

async function processCompanies(companiesTxtFile, companiesFile){

  console.log("Processing Companies...")
  const txtData = fs.readFileSync(companiesTxtFile).toString().split("\r\n");

  let companies = JSON.parse(fs.readFileSync(companiesFile))
  let loggedCompanies = companies.map(a => a.company)

  var companyName, industry, location, size = undefined

  for (var i=0; i<txtData.length; i++) {

    if (txtData[i].includes("Select")){
      companyName = txtData[i+2]
    }
    else if (txtData[i].includes("List")){
      industry = txtData[i+2]
    }
    else if (txtData[i].includes("employees")){
      size = txtData[i].split(" ")[0]
      location = txtData[i+1]

    }
    else if (txtData[i].includes("Add note")){

      // Create Company Object
      let company = new Company(companyName, industry, location, size)
      console.log(company)

      // Checks if Company is already registerd
      if (loggedCompanies.includes(company.company)){
        continue
      }
      else{
        loggedCompanies.push(company.company)
        companies.push(company)
      }
    }
  }
  await save(companies, companiesFile)
  console.log("Finished")
};

async function processUrls(linkedinMatchFile, urlsFile){

  console.log("Processing Urls...")
  const matchData = JSON.parse(fs.readFileSync(linkedinMatchFile))
  let urlSets = JSON.parse(fs.readFileSync(urlsFile))
  let loggedCompanies = urlSets.map(a => a.company)

  for (var i=0;i<matchData.length;i++){
    var urlSet = new UrlSet(matchData[i].company, (matchData[i].linkedinUrl).split("?")[0], matchData[i].websiteUrl)
    if (loggedCompanies.includes(matchData.company)){
      continue
    }
    else{
      loggedCompanies.push(urlSet.company)
      urlSets.push(urlSet)
    }
  }
  await save(urlSets, urlsFile)
  console.log("Finished")
};

async function zipCompanyFiles(companiesFile, companiesCompleteFile, urlsFile=undefined, contactTemplateFile=undefined, companyContactFile=undefined){

  console.log("Zipping company info, urls, templates and general contact info")

  // WARNING: Overwrites Existing urls and templates
  const urls = urlsFile != undefined ? JSON.parse(fs.readFileSync(urlsFile)) : undefined;
  const contactTemplates = contactTemplateFile != undefined ? JSON.parse(fs.readFileSync(contactTemplateFile)) : undefined;
  const companyContact = companyContactFile != undefined ? JSON.parse(fs.readFileSync(companyContactFile)) : undefined;

  const baseCompanies = JSON.parse(fs.readFileSync(companiesFile))
  let completeCompanies = JSON.parse(fs.readFileSync(companiesCompleteFile))
  let completeCompanyNames = completeCompanies.map(a => a.company)

  for (var i=0;i<baseCompanies.length;i++){
    let company = baseCompanies[i]
    if (completeCompanyNames.includes(company.company)){
      continue
    }
    // Zip Url to Company
    if (urls != undefined){
       for (var j=0; j<urls.length; j++){
        if (urls[j].company == company.company){
          company.linkedinUrl = (urls[j].linkedinUrl).split("?")[0]
          company.websiteUrl = urls[j].websiteUrl
          break
        }
        else{
          continue
        }
      }
      if (company.linkedinUrl == undefined){
        console.log(company.company, "is missing its linkedin Url")
      }
      if (company.websiteUrl == undefined){
        console.log(company.company, "is missing its website Url")
      }
    }
    else{
      console.log("No Urls File Found")
    }
   

    // Zip Template to Company
    if ( contactTemplates != undefined){
      for (var j=0; j<contactTemplates.length; j++){
        if (contactTemplates[j].company == company.company){
          company.template = contactTemplates[j].template
          break
        }
        else{
          continue
        }
      }
      if (company.template == undefined){
        console.log(company.company, "is missing its email template")
      }
    }
    else{
      console.log("No Contact Templates File Found")
    }
    
    if (companyContact != undefined){
      for (var j=0;j<companyContact.length;j++){
        if(companyContact[j].company == company.company){
          company.email = companyContact[j].email
          company.phone = companyContact[j].phone
          break
        }
        else{
          continue
        }
      }
      if (company.email == undefined || company.phone == undefined){
        console.log(company.company, "is missing an email and or phone number")
      }
    }
    else{
      console.log("No Company Contacts Found")
    }
    
    completeCompanies.push(company)
    await save(completeCompanies, companiesCompleteFile)
  }
};

async function save(data, path) {

  let jsonData = JSON.stringify(data);
  fs.writeFile(path, jsonData, function (err) {
    if (err) {
      console.log(err);
    }
  });
};

async function zipAndProcess(companiesTxtFile, companiesFile, linkedinMatchFile, urlsFile, contactTemplateFile, companyContactFile){
  await processCompanies(companiesTxtFile, companiesFile)
  await processUrls(linkedinMatchFile, urlsFile)
  await zipCompanyFiles(companiesFile, companyContactFile, urlsFile, contactTemplateFile)
};

async function filterCompanies(companiesFile, good, bad){
  const data = JSON.parse(fs.readFileSync(companiesFile))
  let goodCompanies = []
  let badCompanies = []
  const alwaysExclude = ["Civil Engineering", "Construction", "Law Practice", "Wellness and Fitness Services", "Motor Vehicle Manufacturing",
  "Online Audio and Video Media", "Motor Vehicle Manufacturing", "E-Learning Providers", "Real Estate", "Travel Arrangements", "Printing Services",
  "Government Relations Services", "Food and Beverage Services", "Wholesale", "Appliances, Electrical, and Electronics Manufacturing",
  "Automation Machinery Manufacturing", 'Computer Hardware Manufacturing', 'Manufacturing', 'Hospitality', 'Furniture and Home Furnishings Manufacturing',
  'Fundraising',   'Musicians', 'Aviation and Aerospace Component Manufacturing', 'Measuring and Control Instrument Manufacturing',]

  const alwaysInclude = ["Human Resources Services", "Staffing and Recruiting"]

  for (var i=0;i<data.length;i++){
    if ((parseInt(data[i].size.replace(",", ""))<150 || alwaysInclude.includes(data[i].indusrty)) && !alwaysExclude.includes(data[i].industry)){
      goodCompanies.push(data[i])
    }
    else{
      badCompanies.push(data[i])
    }
  }
  await save(goodCompanies, good)
  await save(badCompanies, bad)
};

/**
async function run(){
  const contactsTxtFile = "txt-files/contacts.txt"
  const contactsFile = "json-files/contacts.json"


  const companiesTxtFile = "txt-files/companies2.txt"

  const companiesFile = "json-files/goodCompanies.json"


  const goodCompaniesFile = "json-files/goodCompanies.json"
  const badCompaniesFile = "json-files/badCompanies.json"


  const linkedinMatchFile = "json-files/linkedinMatchResults2.json"

  const urlsFile = "json-files/urls.json"
  const contactTemplatesFile = "json-files/contactTemplates.json"
  const companyContactFile = "json-files/companyContact.json"


  const companiesCompleteFile = "json-files/goodCompaniesComplete.json"


  const filteredCompaniesFile = "json-files/filteredCompanies.json"

  while (true) {
    const input = prompt("Select Action (process companies, process urls, zip company files, zip and process company files): ")
    if (input == "contacts") {

    } else if (input == "process companies"){

      await processCompanies(companiesTxtFile, companiesFile)

    }else if (input == "process urls"){
      await processUrls(linkedinMatchFile, urlsFile)
    }else if (input == "process contacts"){
      await processContacts(contactsTxtFile, contactsFile)
    }else if (input == "generate emails"){
      await generateEmails(contactsFile, companiesCompleteFile)
    }else if (input == "zip company files"){
      await zipCompanyFiles(companiesFile, companiesCompleteFile, urlsFile, contactTemplatesFile, companyContactFile)
    }else if (input == "zip and process company files"){
      await zipAndProcess(companiesTxtFile, companiesFile, linkedinMatchFile, urlsFile, contactTemplatesFile, companyContactFile, companiesCompleteFile)
    }else if(input == "filter"){
      await filterCompanies(companiesFile, goodCompaniesFile, badCompaniesFile)
    }
    
    else if (input == "exit"){
      break
    }
    else{
      console.log("Invalid Input")
    }
  }
};

run()

*/




