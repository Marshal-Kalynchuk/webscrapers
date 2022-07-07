/** Defines imports required for the functions */
const fs = require('fs');
const prompt = require('prompt-sync')();

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
  constructor(company_name, first_name, middle_name = undefined,
    last_name, role, geography, email = undefined, number = undefined) {
    this.company_name = company_name,
      this.first_name = first_name,
      this.middle_name = middle_name,
      this.last_name = last_name,
      this.role = role,
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
  constructor(company_name, email_template) {
    this.company_name = company_name,
      this.email_template = email_template
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

  trimmed_contacts_file: "./files/trimmed_contacts.json"
};

/** Defines the search terms for the linkedin scraper */
const locations = [
  "Calgary"
];
const keywords = [
  "Front-end Developer"
];

/**Main CLI function. Runs all other functions and manages the data 
 * 
 * To-Do Impliment handling for blank json files
 */
async function main() {

  // initializing the files
  let saved_companies = await JSON.parse(fs.readFileSync(files.companies_save_file))
  let saved_contacts = await JSON.parse(fs.readFileSync(files.contacts_save_file))
  let saved_company_names = saved_companies.map(a => a.company_name)
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
        const linkedin_bot = new Bots.LinkedinBot(false)
        await linkedin_bot.init()
        for (let location in locations) {
          for (let keyword in keywords) {
            const results = await linkedin_bot.scrapeSearch(keyword, location)
            console.log(results)
            // Todo - Check is_in
          }
        }
        break
      case "trim":
        trimmed_contacts = saved_contacts.filter(function (contact) {
          if (contact.website_url != undefined && contact.email != undefined) {
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
  await save(saved_companies, files.companies_save_file)
  await save(saved_contacts, files.contacts_save_file)
  await save(trimmed_contacts, files.trimmed_contacts_file)
};

/**Takes in a raw text from the linkedin sales navigator contact leads 
 * list and turns it into a list of contacts objects. 
 * To-Do - Impliment system to remove none names like PhD and emojis*/
async function processContacts(text_data) {

  let new_contacts = []
  let first_name, middle_name, last_name = undefined

  for (var i = 0; i < text_data.length; i++) {
    if (text_data[i].includes("Select")) {
      var name = text_data[i + 2].split(" ")
      first_name = name[0]
      last_name = name[name.length - 1]
      if (name.length == 3) {
        middle_name = name[1]
      }
    } else if (text_data[i].includes("1 List")) {
      let contact = new Contact(
        text_data[i + 4], // Company Name
        first_name,
        middle_name,
        last_name,
        role = text_data[i + 2],
        geography = text_data[i + 5].split("\t")[0],
      )
      middle_name = undefined
      new_contacts.push(contact)
    }
  }
  return new_contacts
};

/**Takes in a list of contacts and tries to generate emails for them 
 * To-Do - Impliment a already searched system that skips emails we know we can't
 * find the format for and a force search system to override this.
 * 
 * Impliment system to ignore contacts with initials for their last name 
 * Impliment system to ignore none names like PhD*/
async function generateEmails(contacts, force = false) {

  /**Load email templates */
  let email_templates = await JSON.parse(fs.readFileSync(files.email_templates_file))

  /**Create Email bot instance */
  console.log("Starting email bot...")
  const email_bot = new Bots.EmailBot()
  await email_bot.init()

  /**Cycle through list of contacts */
  loop_1:
    for (let contact of contacts) {
      if (contact.email == undefined && contact.company_name != undefined) {
        // Using existing data to generate emails

        for (let i = 0; i < email_templates.length; i++) {
          if (email_templates[i].company_name == contact.company_name) {
            if (email_templates[i].email_template != undefined) {
              contact.email = generateEmail(email_templates[i].email_template, contact.first_name, contact.last_name)
              console.log(`Email format found in database for ${contact.first_name} ${contact.last_name}: ${contact.email}`)
              continue loop_1
            } else if (force) {
              email_templates.splice(i, 1)
              break
            } else {
              console.log(`Email format is undefined in database for ${contact.first_name} ${contact.last_name}`)
              continue loop_1
            }
          }
        }
        /**Use EmailBot to search for email template */
        let new_template = await email_bot.find(contact.company_name)
        /**If email format was found */
        if (new_template != undefined) {

          /**Generate email */
          contact.email = generateEmail(new_template, contact.first_name, contact.last_name)
          email_templates.push(new EmailTemplate(contact.company_name, new_template))

          /**TODO - Update contact database */

          console.log(`Email format found for ${contact.first_name} ${contact.last_name}: ${contact.email}`)
        } else {
          email_templates.push(new EmailTemplate(contact.company_name, undefined))
          console.log(`Could not find email format. Logging as undefined ${contact.first_name} ${contact.last_name}`)
        }
      }else {
        console.log(`Email already registered for ${contact.first_name} ${contact.last_name}`)
      } 
    } 
  await save(email_templates, files.email_templates_file)
  return contacts
};

function generateEmail(template, first_name, last_name) {
  const temp = template.split("@");
  let format = temp[0];
  let domain = temp[1];

  format = format
    .replace("first_name", first_name)
    .replace("first_initial", first_name[0])
    .replace("last_name", last_name)
    .replace("last_initial", last_name[0])

  return format + "@" + domain
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