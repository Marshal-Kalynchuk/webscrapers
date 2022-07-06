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
  console.log("Finished")
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

/**Takes in raw text from the linkedin sales navigator company leads
 * list and turns it into a list of company objects */
async function processCompanies(text_data){

  let new_companies = []
  let company_name, industry, location, size = undefined

  for (let i=0; i<text_data.length; i++) {

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
      console.log(company)
      new_companies.push(company)
    }
  }
  return companies
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

const files = {

  companies_save_file: "",
  companies_text_file: "",

  contacts_save_file: "",
  contacts_text_file: "",
  
}

async function main(){
  let contacts = JSON.parse(fs.readFileSync('./json_files/trialContacts.json'))
  contacts = await generateEmails(contacts)
  //const emails = await JSON.parse(JSON.stringify(contacts.map(a=>a.email)));
  //console.log(`The found emails are: ${emails}`)
  let loop = true
  while (loop) {

    const saved_companies = JSON.parse(fs.readFileSync(files[companies_save_file]))
    const saved_contacts = JSON.parse(fs.readFileSync(files[contacts_save_file]))

    let saved_company_names = saved_companies.map(a => a.company)
    let saved_contact_company_names = saved_contacts.map(a => a.name)

    const input = prompt("Select Action (process companies, process urls, zip company files, zip and process company files): ")

    switch(input){
      case "process companies":
        /** Processing company text data:*/
        const company_text_data = fs.readFileSync(files[companies_text_file]).toString().split("\r\n");
        const processed_companies = await processCompanies(company_text_data)
        const new_companies = processed_companies.filter(company => {
            if(!saved_company_names.includes[company.company]){
              saved_company_names.push(company.company)
              return company
            }
        })
        await save(saved_companies.concat(new_companies), files[companies_save_file])
        break
      case "process contacts":
        /** Processing contact text data */
        const contact_text_data = fs.readFileSync(files[contacts_text_file]).toString().split("\r\n");
        const processed_contacts = await processContacts(contact_text_data)
        const new_contacts = processed_contacts.filter(contact => {
          if(!saved_contact_company_names.includes[contact.name]){
            saved_contact_company_names.push(contact.name)
            return contact
          }
        })
        await save(saved_contacts.concat(new_contacts), files[contacts_save_file])
        break
      case "generate emails":
          /**Add logic... */
        break
      case "process urls" :
        const linkedin_match_data = JSON.parse(fs.readFileSync(files[linkedin_match_file]))
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
        await save(saved_contacts, files[contacts_save_file])
        break
      case "exit":
        loop = false
        break
      default:
        console.log("Invalid Input")
    }
  }
}

main()




