/** Defines imports required for the functions */
const { fail } = require('assert');
const fs = require('fs');
const EmailBot = require('./bots.js');
const prompt = require('prompt-sync')();

/** Used to define the data structure of the companies*/
class Company {
  constructor(company_name, industry, location, size, linkedin_url=undefined, 
    website_url=undefined, phone=undefined, email=undefined) {
    this.company_name = company_name,
    this.industry = industry,
    this.location = location, 
    this.size = size,
    this.linkedin_url = linkedin_url,
    this.website_url = website_url,
    this.phone = phone,
    this.email = email
  };
};

/** Used to define the data structure of the contacts*/
class Contact{
  constructor(company_name, first_name, middle_name = undefined, 
    last_name, role, geography, email=undefined, number=undefined) {
    this.company_name = company_name, 
    this.first_name = first_name,
    this.middle_name = middle_name,
    this.last_name = last_name,
    this.role = role,
    this.email = email,
    this.number = number ,
    this.geography = geography
  };
};

/** Use to defined the data structure of the url sets*/
class UrlSet{
  constructor(company_name, linkedin_url, website_url){
    this.company_name = company_name,
    this.linkedin_url = linkedin_url,
    this.website_url = website_url
  };
};

/** Defines the file locations*/
const files = {

  companies_save_file: "./files/companies_save_file.json",
  companies_text_file: "./files/companies_text_file.txt",

  contacts_save_file: "./files/contacts_save_file.json",
  contacts_text_file: "./files/contacts_text_file.txt",

  linkedin_match_results: "./files/linkedinMatchResults.json"
}

/**Main CLI function. Runs all other functions and manages the data */
async function main(){
  let loop = true

  let saved_companies = await JSON.parse(fs.readFileSync(files.companies_save_file))
  let saved_contacts = await JSON.parse(fs.readFileSync(files.contacts_save_file))

  let saved_company_names = saved_companies.map(a => a.company_name)
  let saved_contact_company_names = saved_contacts.map(a => a.company_name)

  while (loop) {

    const input = prompt("Select Action: ")

    switch(input){
      case "help":
        console.log("The avalible commands are:\nprocess companies\nprocesss urls\nprocess contacts\ngenerate emails")
        break
      case "process companies":
        /** Processing company text data:*/
        const company_text_data = fs.readFileSync(files.companies_text_file).toString().split("\n");
        console.log(company_text_data)
        const processed_companies = await processCompanies(company_text_data)
        const new_companies = processed_companies.filter(company => {
            !saved_company_names.includes[company.company_name]})
        console.log(`Adding ${new_companies.length} new companies to the save file`)
        saved_company_names = saved_company_names.concat(new_companies.map(a=>a.company_name))
        saved_companies = saved_companies.concat(new_companies)
        break
      case "process contacts":
        /** Processing contact text data */
        const contact_text_data = fs.readFileSync(files.contacts_text_file).toString().split("\n");
        const processed_contacts = await processContacts(contact_text_data)
        const new_contacts = processed_contacts.filter(contact => {
          !saved_contact_company_names.includes[contact.company_name]})
        console.log(`Adding ${new_contacts.length} new contacts to the save file`)
        saved_contact_company_names = saved_contact_company_names.concat(new_contacts.map(a=>a.company_name))
        saved_contacts = saved_contacts.concat(new_contacts)
        break
      case "generate emails":
          /**Add logic... */
        break
      case "process urls" :
        const linkedin_match_data = JSON.parse(fs.readFileSync(files.linkedin_match_file))
        const processed_urls = await processUrls(linkedin_match_data)
        for (let url_set of processed_urls){
          for (let contact of saved_contacts){
            if(contact.company == url_set.company){
              if (contact.website_url == undefined){
                contact.website_url = url_set.website_url
              }
              if (contact.linkedin_url == undefined){
                contact.linkedin_url = url_set.linkedin_url
              }
            }
          }
          /**Add code to add urls to the companies */
        }
        break
      case "exit":
        loop = false
        break
      default:
        console.log("Invalid Input. For help type help")
    }
  }
  await save(saved_companies, files.companies_save_file)
  await save(saved_contacts, files.contacts_save_file)
}

/**Takes in a raw text from the linkedin sales navigator contact leads 
 * list and turns it into a list of contacts objects */
async function processContacts(text_data){

  let new_contacts = []
  let first_name, middle_name, last_name = undefined

  for (var i=0; i<text_data.length; i++) {
    if (text_data[i].includes("Select")){
      var name = text_data[i+2].split(" ")
      first_name = name[0]
      last_name = name[name.length - 1]
      if (name.length == 3){
        middle_name = name[1]
      }
    }
    else if (text_data[i].includes("1 List")){
      let contact = new Contact(
        text_data[i+4], // Company Name
        first_name,
        middle_name,
        last_name,
        role = text_data[i+2],
        geography = text_data[i+5].split("\t")[0],
      )
      middle_name = undefined
      new_contacts.push(contact)
    }
  }
  return new_contacts
};

/**Takes in a list of contacts and tries to generate emails for them */
async function generateEmails(contacts){

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
        template = await bot.find(contact.company_name)
        console.log(template)
        if(template != undefined){
          console.log(`Email formate found for: ${contact}`)

          /**Generate email template */
          const split = template.split("@");
          format = split[0]; 
          domain = split[1];

          format = format
          .replace("first_name", contact.first_name)
          .replace("first_initial", contact.first_name[0])
          .replace("last_name", contact.last_name)
          .replace("last_initial", contact.last_name[0])

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

/**Takes in raw text from the linkedin sales navigator company leads
 * list and turns it into a list of company objects */
async function processCompanies(text_data){

  let new_companies = []
  let company_name, industry, location, size = undefined

  for (let i = 0; i<text_data.length; i++) {

    if (text_data[i].includes("Select")){
      company_name = text_data[i+2]
    }
    else if (text_data[i].includes("List")){
      industry = text_data[i+2]
    }
    else if (text_data[i].includes("employees")){
      size = text_data[i].split(" ")[0]
      location = text_data[i+1]
    }
    else if (text_data[i].includes("Add note")){
      // Create Company Object
      let company = new Company(company_name, industry, location, size)
      new_companies.push(company)
    }
  }
  return new_companies
};

/**Processes the linkedin match results and returns a list of linkedin 
 * urls, company urls and company names*/
async function processUrls(linkedin_match_data){
  let url_sets = []
  for (let i = 0;i < linkedin_match_data.length; i++){
    let url_set = new UrlSet(matchData[i].company, (matchData[i].linkedinUrl).split("?")[0], matchData[i].websiteUrl)
    url_sets.push(url_set)
  }
  return url_sets
};

/** Filters the companies based of a given criteria */
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

/** Saves data to json at the specified path */
async function save(data, path) {

  let jsonData = JSON.stringify(data);
  fs.writeFile(path, jsonData, function (err) {
    if (err) {
      console.log(err);
    }
  });
};



/**Depreciated code: */
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
async function zipAndProcess(companiesTxtFile, companiesFile, linkedinMatchFile, urlsFile, contactTemplateFile, companyContactFile){
  await processCompanies(companiesTxtFile, companiesFile)
  await processUrls(linkedinMatchFile, urlsFile)
  await zipCompanyFiles(companiesFile, companyContactFile, urlsFile, contactTemplateFile)
};
/**Depreciated code ^^^ */

main()