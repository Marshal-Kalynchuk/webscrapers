/** Defines imports required for the functions */

const fs = require('fs');
const prompt = require('prompt-sync')();
const axios = require('axios')

// Import bots
const Bots = require('./bots.js');

/** Used to define the data structure of the companies*/
class Company {
  constructor(company_name, industry, location, size, linkedin_url = undefined,
    website_url = undefined, phone = undefined, email = undefined) {
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
class Contact {
  constructor(company_name, first_name, last_name, position,
    geography, email = undefined, number = undefined) {
    this.company_name = company_name,
      this.first_name = first_name,
      this.last_name = last_name,
      this.position = position,
      this.email = email,
      this.number = number,
      this.geography = geography
  };
};

/** Use to defined the data structure of the url sets*/
class UrlSet {
  constructor(company_name, linkedin_url, website_url) {
    this.company_name = company_name,
      this.linkedin_url = linkedin_url,
      this.website_url = website_url
  };
};

/** Used to define the data structure of the email templates */
class EmailTemplate {
  constructor(company_name, email_template, verified, template_score) {
    this.company_name = company_name,
    this.email_template = email_template,
    this.verified = verified,
    this.template_score = template_score
  };
};

/** Defines the file locations*/
/** If the json files must at least have [{}] in them of the function wont work. */
const files = {

  companies_save_file: "./files/companies_save_file.json",
  companies_text_file: "./files/companies_text_file.txt",

  contacts_save_file: "./files/contacts_save_file.json",
  contacts_text_file: "./files/contacts_text_file.txt",

  linkedin_match_file: "./files/linkedinMatchResults.json",

  email_templates_file: "./files/email_templates_file.json",

  trimmed_contacts_file: "./files/trimmed_contacts.json",

  scraped_companies_file: "./files/scraped_companies.json",
  newly_scraped_companies_file: "./files/newly_scraped_companies.json",
  filtered_companies_file: "./files/filtered_companies.json"
};

/** Defines the search terms for the linkedin scraper */
const keywords = ["Angular Developer", "Frontend Developer", "Backend Developer", "Devops Developer", "Full Stack Web Developer", "Full Stack App Developer", "PHP Developer", "Java Developer", "Python Developer", "React Developer", "Vue Developer", "Node JS Developer", "Ruby Developer", /**  "Machine Learing", "AI Developer", "Express js Developer", "UI/UX Developer", "Flutter Developer", "Website Developer", "Website Engineer", "UI/UX Engineer", "Backend Engineer", "Frontend Engineer"*/ ]

const locations = ["Calgary Alberta Canada", "Edmonton Alberta Canada", "Vancouver British Columbia Canada", "Winnipeg Manitoba Canada", "Victoria British Columbia", "Saskatoon Saskatchwan Canada", "Regina Saskatchewan Canada", "Toronto Ontario Canada", "California United States", "Ottawa Ontario Canada", "New York United States", "Houston Texas United States", "Nova Scotia Canada", "New Brunswick Canada"]

/**Main CLI function. Runs all other functions and manages the data 
 * 
 * To-Do Impliment handling for blank json files
 */
async function main() {

  // initializing the files
  let saved_companies = await JSON.parse(fs.readFileSync(files.companies_save_file))
  let saved_contacts = await JSON.parse(fs.readFileSync(files.contacts_save_file))
  let scraped_companies = await JSON.parse(fs.readFileSync(files.scraped_companies_file))
  let saved_company_names = await saved_companies.map(a => a.company_name)
  let trimmed_contacts = []

  let loop = true
  while (loop) {

    // Counters, no function outside of displaying amounts added:
    let c = 0
    let b = 0
    const input = prompt("Select Action: ")

    // Main CLI
    switch (input) {
      case "help":
        console.log("The avalible commands are:\nprocess companies\nprocesss urls\nprocess contacts\ngenerate emails")
        break
      case "companies":
        /** Processing company text data:*/
        const company_text_data = fs.readFileSync(files.companies_text_file).toString().split("\n");
        const processed_companies = await processCompanies(company_text_data)
        const new_companies = processed_companies.filter(function (company) {
          if (!saved_company_names.includes(company.company_name)) {
            saved_company_names.push(company.company_name)
            return company
          }
        })
        console.log(`Adding ${new_companies.length} new companies to the save file`)
        saved_companies = saved_companies.concat(new_companies)
        break
      case "contacts":
        /** Processing contact text data */
        const contact_text_data = fs.readFileSync(files.contacts_text_file).toString().split("\n");
        const processed_contacts = await processContacts(contact_text_data)
        for (let new_contact of processed_contacts) {
          let is_in = false
          for (let saved_contact of saved_contacts) {
            if (saved_contact.first_name == new_contact.first_name &&
              saved_contact.last_name == new_contact.last_name &&
              saved_contact.company_name == new_contact.company_name) {
              is_in = true
              break
            }
          }
          if (!is_in) {
            saved_contacts.push(new_contact)
            c += 1
          }
        }
        console.log(`Adding ${c} new contacts to the save file`)
        break
      case "emails":
        saved_contacts = await generateEmails(saved_contacts)
        break
      case "urls":
        const linkedin_match_data = JSON.parse(fs.readFileSync(files.linkedin_match_file))
        const processed_urls = await processUrls(linkedin_match_data)
        for (let url_set of processed_urls) {
          for (let contact of saved_contacts) {
            if (contact.company_name == url_set.company_name) {
              if (contact.website_url == undefined) {
                contact.website_url = url_set.website_url
                c++
              }
              if (contact.linkedin_url == undefined) {
                contact.linkedin_url = url_set.linkedin_url
                b++
              }
            }
          }
          /**Add code to add urls to the companies */
        }
        console.log(`${c} website urls added, ${b} linkedin urls added.`)
        break
      case "scrape":
        const linkedin_bot = new Bots.LinkedinBot(true)
        await linkedin_bot.init()
        for (let location of locations) {
          for (let keyword of keywords) {
            console.log(`Searching for ${keyword} in ${location}...`)
            scraped_companies = await JSON.parse(fs.readFileSync(files.scraped_companies_file))
            newly_scraped_companies = await JSON.parse(fs.readFileSync(files.newly_scraped_companies_file))
            const results = await linkedin_bot.scrapeSearch(keyword, location)
            for (let res of results) {
              if (!await checkCompany(scraped_companies, res.company_name)) {
                scraped_companies.push(res)
                newly_scraped_companies.push(res)
                console.log(`Adding new company: ${res.company_name}`)
              } else {
                console.log(`Already logged ${res.company_name}`)
              }
            }
            // Ensures minimal data loss if error occures in long operation
            save(scraped_companies, files.scraped_companies_file)
            save(newly_scraped_companies, files.newly_scraped_companies_file)
          }
        }
        console.log("Finished")
        break
      case "trim":
        trimmed_contacts = saved_contacts.filter(function (contact) {
          if (/**contact.website_url != undefined && */contact.email != undefined) {
            return contact
          }
        })
        break
      case "exit":
        loop = false
        break
      default:
        console.log("Invalid Input. For help type help")
    }
  }

  // Saving the files
  save(saved_companies, files.companies_save_file)
  save(saved_contacts, files.contacts_save_file)
  save(trimmed_contacts, files.trimmed_contacts_file)
};

// Checks if the company is already in the saved companies file
async function checkCompany(saved_companies, company_name) {
  for (var i = 0; i < saved_companies.length; i++) {
    if (saved_companies[i].company_name == company_name) {
      return true
    }
  }
  return false
};

const regex = /\([^()]*\)/g

/**Takes in a raw text from the linkedin sales navigator contact leads 
 * list and turns it into a list of contacts objects. 
 * To-Do - Impliment system to remove none names like PhD and emojis*/
async function processContacts(text_data) {

  // Init
  let new_contacts = []
  let name, first_name, last_name, company_name, position, geography = undefined
  const exclude = []

  // Loop though each line of text
  for (var i = 0; i < text_data.length; i++) {

    if (text_data[i].includes("Select")) {

      // Get Name off "Select" keyword
      name = text_data[i + 2]

    } else if (text_data[i].includes("List")) {

      // Get additional information off of "List" keyword and create contact
      company_name = text_data[i + 4]
      position = text_data[i + 2].replace("\r", "")
      geography = text_data[i + 5].split("\t")[0]

      // Remove (+1) etc.
      company_name = company_name.replace(regex, "").trim()

      /** Format name into first name, last name and remove unwanted chars.
       *  Should work for 99% of contacts. You will lose contacts formatted like 
       *  "first_name, last_name" because of the comma. Can not handle weird cases 
       *  like "R. Cog-Spa" for Cognitive Space. It will log that so be warned */

      name = cleanString(name)
      name = name
        .replace(regex, "")
        .replace("'", "")
        .replace("\r", "")
        .trim()

      // Removes "MBA, PhD etc. Might lose 1% of contact last names"
      name = name.split(",")[0]
      let temp = name.split(" ")
      first_name = temp[0]
      last_name = temp[temp.length - 1]

      let contact = new Contact(company_name, first_name, last_name, position, geography)
      new_contacts.push(contact)
    }
  }
  return new_contacts
};

// Removed unwanted charaters from string
function cleanString(input) {
  var output = "";
  for (var i = 0; i < input.length; i++) {
    if (input.charCodeAt(i) <= 127) {
      output += input.charAt(i);
    }
  }
  return output;
}

/**Takes in a list of contacts and tries to generate emails for them 
 * To-Do - Impliment a already searched system that skips emails we know we can't
 * find the format for and a force search system to override this.
 * 
 * Impliment system to ignore contacts with initials for their last name 
 * Impliment system to ignore none names like PhD*/
async function generateEmails(contacts, force = false) {

  console.log(`Starting Email Generation.\n\rIf a contact is skipped during template validaty analysis, re-run the program after to apply found templates to them.`)

  const whoisxmlapi_api_key = "at_mp0pXIJFeZBYXnzgopWktb7uBBTbf"
  const api_calls_allowed = true
  
  /**Create Email bot instance */
  console.log("Starting email bot...")
  const email_bot = new Bots.EmailBot()
  await email_bot.init()

  /**Cycle through list of contacts 
   * Skips contacts that with names including "."
   * For instance: St.Marie or John M.
  */
  loop_1: for (let contact of contacts) {
    
    console.log("--------------------------------------------------------------------------------")
    console.log(`Evaluating: `, contact)
    if (contact.email == undefined &&
      contact.company_name != undefined) {
      
      let email_templates = await JSON.parse(fs.readFileSync(files.email_templates_file))

      const first_name = contact.first_name || undefined
      const first_initial = first_name ? contact.first_name[0] : undefined
      const last_name = contact.last_name || undefined
      const last_initial = last_name ? last_name[0] : undefined
      const name_properties = {first_name, first_initial, last_name, last_initial}
   
      // Try to find exsiting template
      let template = {}
      for (let i = 0; i < email_templates.length; i++) {
        if (email_templates[i].company_name == contact.company_name) {
          template = email_templates[i]
        }
      }

      switch (template.verified) {
        case true:
          // Generate email

          let temp_email = generateEmail(template.email_template, name_properties)
          if (temp_email){
            contact.email = temp_email
            console.log("Applying template: ", template)
            console.log(`Email for ${first_name} ${last_name} is ${contact.email}`)
          } else {
            contact.email = undefined
            console.log(`Could not apply template ${template.email_template} to ${first_name} ${last_name}`)
          }
          break
        case undefined:
          // Look for email

          /**Use EmailBot to search for email template. Max results set to 1 to limit api calling*/
          let results = await email_bot.find(contact.company_name, 1)
          let verified = false
          let best_score = -1
          let best_template = undefined
          let company_name = contact.company_name
          let contact_email = undefined

          /**If email format was found */
          if (results) {
            for (let res of results) {

              let should_break = false
              if (res.template_score > best_score) {
                best_score = res.template_score
                best_template = res.email_template
              }
              let temp_email = generateEmail(res.email_template, name_properties)
              if (temp_email){
                console.log(`Validating email format ${res.email_template}...`)
                // Perform verification
                // Using percent chance of the email being valid:
                if (res.template_score > 60) {
                  console.log("Email score above 60.")
                  console.log(`Email format ${res.email_template} is verified`)
                  verified = true
                  best_score = res.template_score
                  best_template = res.email_template
                  contact_email = temp_email
                  should_break = true
                } else if (api_calls_allowed) {
                  console.log("Calling verification API...")
                  await axios.get(`https://emailverification.whoisxmlapi.com/api/v2?apiKey=${whoisxmlapi_api_key}&emailAddress=${temp_email}`).then(resp=>{

                    let data = resp.data
                    const {mxRecords, audit, ...display} = data
                    console.log(`Response:`, display)

                    // Evaluate the response
                    if (data.smtpCheck == 'true' && data.formatCheck == 'true'){
                      console.log(`Email format ${res.email_template} is verified`)
                      verified = true
                      best_score = res.template_score
                      best_template = res.email_template
                      contact_email = temp_email
                      should_break = true
                    } else{
                      console.log(`Email format ${res.email_template} is invalid.`)
                    }
                  })
                }
                if (should_break){break}
              } else {
                console.log(`Could not apply template ${template.email_template} to ${first_name} ${last_name}`)
                console.log(`Skipping contact due to bad candidate for validity anaylsis.`)
                save(email_templates, files.email_templates_file)
                continue loop_1
              }
              
            }
          }
          template = new EmailTemplate(
            company_name,
            best_template,
            verified,
            best_score)

          contact.email = contact_email
          email_templates.push(template)

          console.log("Adding new", template)
          console.log(`Email for ${first_name} ${last_name} is ${contact.email}`)

          break
        case false:
          // Email Template does not work
          console.log(`Found existing template:`, template)
          console.log(`Email format was defined as invalid from null searches or low validation score.`)
          break
      }
      save(email_templates, files.email_templates_file)
    } else{
      console.log(`Skipping contact because it failed to pass the health check`)
    }
  }
  await email_bot.quit()
  console.log("Finished")
  return contacts
};

function generateEmail(template, name_properties) {


  /**  Return undefined for names like St.Marie
  if (name_properties.first_name != undefined){
    if (name_properties.first_name.toUpperCase().includes("ST.")){
      return undefined
    }
  }
  if (name_properties.last_name != undefined){
    if (name_properties.last_name.toUpperCase().includes("ST.")){
      return undefined
    }
  }
  */
  // Return undefined for templates that require information that is not given
  if (template.includes("first_initial")){
    if (name_properties.first_initial != undefined){
      template = template.replace("first_initial", name_properties.first_initial)
    } else {
      return undefined
    }
  } 
  else if (template.includes("first_name")) {
    if (name_properties.first_name != undefined){
      template = template.replace("first_name", name_properties.first_name)
    } else {
     return undefined
    }
  }
    
  if (template.includes("last_initial")) {
    if (name_properties.last_initial != undefined){
      template = template.replace("last_initial", name_properties.last_initial)
    } else {
    return undefined
    }
  }
  else if (template.includes("last_name")) {
    if (name_properties.last_name != undefined) {
      template = template.replace("last_name", name_properties.last_name)
    } else {
      return undefined
    }
  }

  return template.toLowerCase()
};

/**Takes in raw text from the linkedin sales navigator company leads
 * list and turns it into a list of company objects */
async function processCompanies(text_data) {

  let new_companies = []
  let company_name, industry, location, size = undefined

  for (let i = 0; i < text_data.length; i++) {

    if (text_data[i].includes("Select")) {
      company_name = text_data[i + 2]
    } else if (text_data[i].includes("List")) {
      industry = text_data[i + 2]
    } else if (text_data[i].includes("employees")) {
      size = text_data[i].split(" ")[0]
      location = text_data[i + 1]
    } else if (text_data[i].includes("Add note")) {
      // Create Company Object
      let company = new Company(company_name, industry, location, size)
      new_companies.push(company)
    }
  }
  return new_companies
};

/**Processes the linkedin match results and returns a list of linkedin 
 * urls, company urls and company names*/
async function processUrls(linkedin_match_data) {
  return linkedin_match_data.map(data => new UrlSet(data.company, data.linkedinUrl.split("?")[0], data.websiteUrl))
};

/** Filters the companies based of a given criteria 
 * To-Do - reformat naming conventing and improve filter
 */
async function filterCompanies(companiesFile, good, bad) {
  const data = JSON.parse(fs.readFileSync(companiesFile))
  let goodCompanies = []
  let badCompanies = []
  const alwaysExclude = ["Civil Engineering", "Construction", "Law Practice", "Wellness and Fitness Services", "Motor Vehicle Manufacturing",
    "Online Audio and Video Media", "Motor Vehicle Manufacturing", "E-Learning Providers", "Real Estate", "Travel Arrangements", "Printing Services",
    "Government Relations Services", "Food and Beverage Services", "Wholesale", "Appliances, Electrical, and Electronics Manufacturing",
    "Automation Machinery Manufacturing", 'Computer Hardware Manufacturing', 'Manufacturing', 'Hospitality', 'Furniture and Home Furnishings Manufacturing',
    'Fundraising', 'Musicians', 'Aviation and Aerospace Component Manufacturing', 'Measuring and Control Instrument Manufacturing',
  ]

  const alwaysInclude = ["Human Resources Services", "Staffing and Recruiting"]

  for (var i = 0; i < data.length; i++) {
    if ((parseInt(data[i].size.replace(",", "")) < 150 || alwaysInclude.includes(data[i].indusrty)) && !alwaysExclude.includes(data[i].industry)) {
      goodCompanies.push(data[i])
    } else {
      badCompanies.push(data[i])
    }
  }
  save(goodCompanies, good)
  save(badCompanies, bad)
};

/** Saves data to json at the specified path */
function save(data, path) {

  let jsonData = JSON.stringify(data);
  fs.writeFileSync(path, jsonData, function (err) {
    if (err) {
      console.log(err);
    }
  });
};


/**Depreciated code: */
async function zipCompanyFiles(companiesFile, companiesCompleteFile, urlsFile = undefined, contactTemplateFile = undefined, companyContactFile = undefined) {

  console.log("Zipping company info, urls, templates and general contact info")

  // WARNING: Overwrites Existing urls and templates
  const urls = urlsFile != undefined ? JSON.parse(fs.readFileSync(urlsFile)) : undefined;
  const contactTemplates = contactTemplateFile != undefined ? JSON.parse(fs.readFileSync(contactTemplateFile)) : undefined;
  const companyContact = companyContactFile != undefined ? JSON.parse(fs.readFileSync(companyContactFile)) : undefined;

  const baseCompanies = JSON.parse(fs.readFileSync(companiesFile))
  let completeCompanies = JSON.parse(fs.readFileSync(companiesCompleteFile))
  let completeCompanyNames = completeCompanies.map(a => a.company)

  for (var i = 0; i < baseCompanies.length; i++) {
    let company = baseCompanies[i]
    if (completeCompanyNames.includes(company.company)) {
      continue
    }
    // Zip Url to Company
    if (urls != undefined) {
      for (var j = 0; j < urls.length; j++) {
        if (urls[j].company == company.company) {
          company.linkedinUrl = (urls[j].linkedinUrl).split("?")[0]
          company.websiteUrl = urls[j].websiteUrl
          break
        } else {
          continue
        }
      }
      if (company.linkedinUrl == undefined) {
        console.log(company.company, "is missing its linkedin Url")
      }
      if (company.websiteUrl == undefined) {
        console.log(company.company, "is missing its website Url")
      }
    } else {
      console.log("No Urls File Found")
    }


    // Zip Template to Company
    if (contactTemplates != undefined) {
      for (var j = 0; j < contactTemplates.length; j++) {
        if (contactTemplates[j].company == company.company) {
          company.template = contactTemplates[j].template
          break
        } else {
          continue
        }
      }
      if (company.template == undefined) {
        console.log(company.company, "is missing its email template")
      }
    } else {
      console.log("No Contact Templates File Found")
    }

    if (companyContact != undefined) {
      for (var j = 0; j < companyContact.length; j++) {
        if (companyContact[j].company == company.company) {
          company.email = companyContact[j].email
          company.phone = companyContact[j].phone
          break
        } else {
          continue
        }
      }
      if (company.email == undefined || company.phone == undefined) {
        console.log(company.company, "is missing an email and or phone number")
      }
    } else {
      console.log("No Company Contacts Found")
    }

    completeCompanies.push(company)
    await save(completeCompanies, companiesCompleteFile)
  }
};
async function zipAndProcess(companiesTxtFile, companiesFile, linkedinMatchFile, urlsFile, contactTemplateFile, companyContactFile) {
  await processCompanies(companiesTxtFile, companiesFile)
  await processUrls(linkedinMatchFile, urlsFile)
  await zipCompanyFiles(companiesFile, companyContactFile, urlsFile, contactTemplateFile)
};
/**Depreciated code ^^^ */


main()