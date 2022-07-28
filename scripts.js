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
class EmailFormat {
  constructor(company_name, format, verified, score) {
    this.company_name = company_name,
      this.format = format,
      this.verified = verified,
      this.score = score
  };
};

/** Defines the file locations*/
/** If the json files must at least have [{}] in them of the function wont work. */
const files = {

  companies_save_file: "./files/companies_save_file.json",
  companies_text_file: "./raw_files/bulk_import_4.txt",

  contacts_save_file: "./files/contacts_save_file.json",
  contacts_text_file: "./files/contacts_text_file.txt",

  linkedin_match_file: "./raw_files/match_results_composit.json",

  formats_file: "./files/formats_file.json",

  trimmed_contacts_file: "./files/trimmed_contacts.json",

  scraped_companies_file: "./files/scraped_companies.json",
  newly_scraped_companies_file: "./files/newly_scraped_companies.json",
  filtered_companies_file: "./files/filtered_companies.json"
};



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

  cli: while (true) {

    // Counters, no function outside of displaying amounts added:
    let c = 0
    let b = 0
    let d = 0
    let e = 0
    const input = prompt("Select Action: ")

    // Main CLI
    switch (input) {
      case "help":
        console.log("The avalible commands are:\nprocess companies\nprocesss urls\nprocess contacts\ngenerate emails")
        break
      case "companies":
        /** Processing company text data:*/
        const company_text_data = fs.readFileSync(files.companies_text_file).toString().split("\n");
        const processed_companies = await process_companies(company_text_data)
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
        const processed_contacts = await process_contacts(contact_text_data)
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
        saved_contacts = await generate_emails(saved_contacts)
        break
      case "urls":
        const linkedin_match_data = JSON.parse(fs.readFileSync(files.linkedin_match_file))
        const processed_urls = await process_urls(linkedin_match_data)
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
        }
        /**Add code to add urls to the companies */
        for (let url_set of processed_urls) {
          for (let company of saved_companies) {
            if (company.company_name == url_set.company_name) {
              if (company.website_url == undefined) {
                company.website_url = url_set.website_url
                d++
              }
              if (company.linkedin_url == undefined) {
                company.linkedin_url = url_set.linkedin_url
                e++
              }
            }
          }
        }
        console.log(`Contacts: ${c} website urls added, ${b} linkedin urls added.`)
        console.log(`Companies: ${d} website urls added, ${e} linkedin urls added.`)
        break
      case "scrape":
        const job_bot = new Bots.JobBot(true)
        await job_bot.init()
        await job_bot.scrape_companies()
        break
      case "trim":
        trimmed_contacts = saved_contacts.filter(function (contact) {
          if ( contact.website_url != undefined && contact.email != undefined) {
            return contact
          }
        })
        break
      case "exit":
        break cli
      case "filter":
        save(saved_companies.filter(is_good_company), files.filtered_companies_file)
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

const regex_for_name = /\([^()]*\)/g
const regex_for_company = /\([^(a-zA-Z)]*\)/g

/**Takes in a raw text from the linkedin sales navigator contact leads 
 * list and turns it into a list of contacts objects. 
 * To-Do - Impliment system to remove none names like PhD and emojis*/
async function process_contacts(text_data) {

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
      company_name = company_name.replace(regex_for_company, "").trim()

      /** Format name into first name, last name and remove unwanted chars.
       *  Should work for 99% of contacts. You will lose contacts formatted like 
       *  "first_name, last_name" because of the comma. Can not handle weird cases 
       *  like "R. Cog-Spa" for Cognitive Space. It will log that so be warned */

      name = clean_string(name)
      name = name
        .replace(regex_for_name, "")
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
function clean_string(input) {
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
async function generate_emails(contacts) {

  console.log(`Starting Email Generation.\n\rIf a contact is skipped during template validaty analysis, re-run the program after to apply found templates to them.`);

  /**Create Email bot instance */
  console.log("Starting email bot...");
  const email_bot = new Bots.EmailBot(true);
  await email_bot.init();

  /**Cycle through list of contacts 
   * Skips contacts that with names including "."
   * For instance: St.Marie or John M.
   */
  for (let contact of contacts) {
    if (contact.company_name != undefined && contact.email == undefined) {

      console.log("--------------------------------------------------------------------------------");
      console.log(`Evaluating ${contact.first_name} ${contact.last_name}, ${contact.company_name}`);
      const name = {
        first_name: contact.first_name ? contact.first_name.length > 2 ? contact.first_name : undefined : undefined,
        first_initial: contact.first_name ? contact.first_name[0] : undefined,
        last_name: contact.last_name ? contact.last_name.length > 2 ? contact.last_name : undefined : undefined,
        last_initial: contact.last_name ? contact.last_name[0] : undefined
      };
      const format =  await email_bot.get_format(contact.company_name, contact.website_url, {overwrite_undefined: true, api_calls: true})
      if (format) {
        console.log(`Format: ${format.format}, Score: ${format.score}, Type: ${format.type}, `);
        if (format.score > 50) {
          // Applying format
          contact.email = apply_format(format.format);

          function apply_format(format) {
            if (format.includes("first_initial")) {
              if (name.first_initial != undefined) {
                format = format.replace("first_initial", name.first_initial);
              } else {
                return undefined;
              };
            } else if (format.includes("first_name")) {
              if (name.first_name != undefined) {
                format = format.replace("first_name", name.first_name);
              } else {
                return undefined;
              };
            };
            if (format.includes("last_initial")) {
              if (name.last_initial != undefined) {
                name.last_initial = name.last_initial.replace(".", "");
                format = format.replace("last_initial", name.last_initial);
              } else {
                return undefined;
              };
            } else if (format.includes("last_name")) {
              if (name.last_name != undefined) {
                format = format.replace("last_name", name.last_name);
              } else {
                return undefined;
              };
            };
            return format.toLowerCase();
          };
        }
      } else {
        console.log("No Format Found")
      }
      console.log(`Email for ${contact.first_name} ${contact.last_name} is ${contact.email}.`);
    }
  };
  console.log("Finished");
  await email_bot.quit();
  return contacts;
};

/**Takes in raw text from the linkedin sales navigator company leads
 * list and turns it into a list of company objects */
async function process_companies(text_data) {

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
async function process_urls(linkedin_match_data) {
  return linkedin_match_data.map(function (data) {
    return new UrlSet(
      (data["company_name"] || data["company"] || data["Account Name"]),
      (data["linkedin_url"] || data["Linkedin Compnay URL"] || data["linkedinUrl"]),
      (data["Matched Company Url"]))
  })
}

/** Filters the companies based of a given criteria 
 * To-Do - reformat naming conventing and improve filter
 */
function is_good_company(company) {

  const exclude_industry = ["Civil Engineering", "Construction", "Law Practice", "Wellness and Fitness Services", "Motor Vehicle Manufacturing",
    "Online Audio and Video Media", "Motor Vehicle Manufacturing", "E-Learning Providers", "Real Estate", "Travel Arrangements", "Printing Services",
    "Government Relations Services", "Food and Beverage Services", "Wholesale", "Appliances, Electrical, and Electronics Manufacturing",
    "Automation Machinery Manufacturing", 'Computer Hardware Manufacturing', 'Manufacturing', 'Hospitality', 'Furniture and Home Furnishings Manufacturing',
    'Fundraising', 'Musicians', 'Aviation and Aerospace Component Manufacturing', 'Measuring and Control Instrument Manufacturing', 'Executive Offices',
    'Transportation, Logistics, Supply Chain and Storage', 'Higher Education', 'Retail Motor Vehicles', 'Biotechnology Research', 'Computers and Electronics Manufacturing',
    'Hospitals and Health Care', 'Government Administration', 'Truck Transportation'
  ]

  const always = ["Human Resources Services", "Staffing and Recruiting"]
  const maybe = ["Software Development", "Technology, Information and Internet", "IT Services and IT Consulting", "Computer and Network Security", "Computer Games", "Information Services"]

  if ((company.location.includes("United States") || company.location.includes("Canada")) &&
    ((always.includes(company.industry) || (parseInt(company.size.replaceAll(",", "")) <= 300 && maybe.includes(company.industry))))) {
    return true
  } else {
    return false
  }
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
  await process_companies(companiesTxtFile, companiesFile)
  await process_urls(linkedinMatchFile, urlsFile)
  await zipCompanyFiles(companiesFile, companyContactFile, urlsFile, contactTemplateFile)
};
/**Depreciated code ^^^ */


main()