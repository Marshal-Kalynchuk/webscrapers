const puppeteer = require('puppeteer');
const fs = require('fs');
const {
  v4: uuidv4
} = require('uuid');
const axios = require('axios')

class DataStore {
  constructor(path) {
    this.path = path;
    this.data = JSON.parse(fs.readFileSync(path));
  };
  create() {
    return this.data_model;
  };
  get(field, query, max_results) {
    let results = [];
    for (let obj of this.data) {
      if (obj[field] === query) {
        results.push(obj);
      };
    };
    return results;
  };
  multi_post(objs, unique_keys = []){
    let posted_objs = [];
    for (let obj of objs){
      posted_objs.push(this.post(obj, unique_keys));
    };
    return posted_objs.filter( Boolean );
  };
  post(obj, unique_keys = []) {
    // enable naming protection off model.
    let should_post = true;
    if (unique_keys.length){
      let match = false;
      for (let d of this.data){
        match = true;
        for (let key of unique_keys){
          if (d[key] != obj[key]){
            match = false;
          };
        };
        if (match){
          should_post = false;
          break;
        };
      };
    };
    if (should_post){
      obj.id = uuidv4();
      // Add duplicate protection
      this.data.push(obj);
      fs.writeFileSync(this.path, JSON.stringify(this.data), function (err) {
        if (err) {
          console.log(err);
        }
      });
      return obj;
    } else {
      return null;
    };
  };
  put(id, field, value) {
    let changed = undefined
    for (let obj of this.data) {
      if (obj.id === id) {
        obj[field] = value;
        changed = obj;
        break;
      };
    };
    fs.writeFileSync(this.path, JSON.stringify(this.data), function (err) {
      if (err) {
        console.log(err);
      };
    });
    this.data = JSON.parse(fs.readFileSync(this.path));
    return changed;
  };
  delete(id) {
    let deleted = undefined
    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i].id === id) {
        deleted = this.data.splice(i, 1)
      }
    }
    fs.writeFileSync(this.path, JSON.stringify(this.data), function (err) {
      if (err) {
        console.log(err);
      }
    });
    return deleted
  };
};
class Puppet {
  constructor(devMode = false, config) {
    /**Configuration of puppeteer */
    this.devMode = devMode
    this.browserArgs = {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: !devMode,
      ignoreHTTPSErrors: true,
      defaultViewport: null
    };
    this.config = config
    this.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.75 Safari/537.36';
  };
  // Starts Puppeteer page and browser with default settings
  async init({
    config = this.config
  } = {}) {
    /**Creates the puppeteer instance */

    /**Initialze browser */
    const browser = await puppeteer.launch(this.browserArgs);
    const page = await browser.newPage();
    //Randomize viewport size
    await page.setViewport({
      width: 1600 + Math.floor(Math.random() * 100),
      height: 900 + Math.floor(Math.random() * 100),
      deviceScaleFactor: 1,
      hasTouch: false,
      isLandscape: false,
      isMobile: false,
    });
    await page.setUserAgent(this.userAgent);
    await page.setJavaScriptEnabled(true);
    page.setDefaultNavigationTimeout(0);
    //Skip images/styles/fonts loading for performance
    await page.setRequestInterception(true);

    page.on('request', (req) => {
      if ((req.resourceType() == 'ximage') ||
        (req.resourceType() == 'xstylesheet') ||
        (req.resourceType() == 'xfont') ||
        (req.resourceType() == 'xgif')
      ) {
        req.abort();
      } else {
        req.continue();
      };
    });

    await page.evaluateOnNewDocument(() => {
      // Pass webdriver check
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    });
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "languages", {
        get: function () {
          return ["en-US", "en"];
        }
      });
    });
    await page.evaluateOnNewDocument(() => {
      // overwrite the `plugins` property to use a custom getter
      Object.defineProperty(navigator, 'plugins', {
        get: function () {
          // this just needs to have `length > 0`, but we could mock the plugins too
          return [1, 2, 3, 4, 5];
        },
      });
    });
    await page.evaluateOnNewDocument(function () {
      navigator.geolocation.getCurrentPosition = function (cb) {
        setTimeout(() => {
          cb({
            'coords': {
              accuracy: 21,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              latitude: 23.129163,
              longitude: 113.264435,
              speed: null
            }
          })
        }, 1000)
      };
    });
    await page.evaluateOnNewDocument(() => {
      // Pass chrome check
      window.chrome = {
        runtime: {},
        // etc.
      };
    });
    await page.evaluateOnNewDocument(() => {
      //Pass notifications check
      const originalQuery = window.navigator.permissions.query;
      return window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
        Promise.resolve({
          state: Notification.permission
        }) :
        originalQuery(parameters)
      );
    });
    await page.evaluateOnNewDocument(() => {
      // Overwrite the `plugins` property to use a custom getter.
      Object.defineProperty(navigator, 'plugins', {
        // This just needs to have `length > 0` for the current test,
        // but we could mock the plugins too if necessary.
        get: () => [1, 2, 3, 4, 5],
      });
    });
    await page.evaluateOnNewDocument(() => {
      // Overwrite the `languages` property to use a custom getter.
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
    });
    await page.setCookie();
    if (config.initial_url) {
      await page.goto(config.initial_url);
    };
    this.browser = browser;
    this.page = page;
    console.log("Page initialized");
  };
  // Navigates to the given url
  async navigate(url) {
    await this.page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 0
    });
  };
  // Extracts data that is in list format
  async list_data({
    config = this.config
  } = {}) {
    return await this.page.evaluate(async (config) => {
      return [...document.querySelectorAll(config.card_sel)].map(card => {
        let object = {};
        for (const [key, value] of Object.entries(config.card_fields)) {
          object[key] = card.querySelector(value[0]) ? card.querySelector(value[0])[value[1]] : undefined;
        };
        return object;
      });
    }, config);
  };
  // Compounds searchUrl, navigate, and listData to easily scrape search
  async scrape({
    config = this.config,
    field_1 = undefined,
    field_2 = undefined,
    url = this.config.search_url,
  } = {}) {

    url = url.replace("field_1", field_1).replace("field_2", field_2);
    let data = undefined;
    let attempts = 0;
    const max_attempts = 6;

    while (attempts < max_attempts) {
      try {
        await this.navigate(url);
        await delay(config.navigation_delay);
        data = await this.list_data(config);
        break;
      } catch (err) {
        console.log(err);
        console.log(`Something threw an error. Assumed to be due to authwall.`);
        console.log(`Attempting to by-pass authwall... Attempt: ${attempts}/${max_attempts}`);
        await this.authwall(config);
        attempts += 1;
      };
    };
    data = data.filter((obj)=>Object.keys(obj).length != 0)
    if (config.origin) {
      data = data.map((a => {
        a.origin = config.origin;
        return a
      }))
    }
    return data;
  };
  // Closes Puppeteer page and browser
  async quit() {
    await this.page.close();
    await this.browser.close();
  };
  // Generic authwall bypass:
  async authwall({
    config = this.config
  }) {
    // Do nothing. Will just re-navigate to search url.
  };
};
class GoogleBot extends Puppet {
  constructor(devMode = false) {
    const google_config = {
      navigation_delay: 30000,
      search_url: "https://google.com/search?q=field_1",
      card_sel: "div.jtfYYd",
      card_fields: {
        url: ["div.NJo7tc.Z26q7c.jGGQ5e > div > a", "href"],
        title: ["div.NJo7tc.Z26q7c.jGGQ5e > div > a > h3", "innerText"],
        description: ["div.NJo7tc.Z26q7c.uUuwM > div.VwiC3b", "innerText"]
      },
      origin: 'google'
    };
    super(devMode, google_config)
  };
};
class EmailBot extends GoogleBot {
  constructor(devMode = false) {
    super(devMode);
    this.rocket_config = {
      navigation_delay: 12000,
      card_sel: "tbody tr",
      card_fields: {
        format: ["td:nth-child(2)", "innerText"],
        score: ["td:nth-child(3) > div > span", "innerText"]
      },
      origin: 'rocketreach'
    };
    this.signalhire_config = {
      navigation_delay: 12000,
      card_sel: "tbody > tr",
      card_fields: {
        format: ["td:nth-child(2) > a", "innerText"],
        score: ["td:nth-child(3)", "innerText"]
      },
      origin: 'signalhire'
    };
    this.webspotter_config = {
      navigation_delay: 10000,
      card_sel: "tbody > tr",
      card_fields: {
        format: ["td:nth-child(1)", "innerText"],
        score: ["td:nth-child(3)", "innerText"]
      },
      origin: 'webspotter'
    };
    this.format_identifiers = {
      first_name: "first_name",
      first_initial: "first_initial",
      last_name: "last_name",
      last_initial: "last_initial"
    };
    this.format_model = {
      company_name: undefined,
      type: undefined,
      format: undefined,
      score: 0,
    };
    this.type_identifiers = {
      personal: "personal",
      general: "general"
    };
    this.formats_file = "./files/formats_file.json";
    this.api_key = "at_mp0pXIJFeZBYXnzgopWktb7uBBTbf";
    this.general_formats = ["info", "hello"]

    this.datastore = new DataStore(this.formats_file, this.format_model)
  };
  async general_format(company_name, website) {
    let results = []
    const domain = website.split("//")[1].split("/")[0].replace("www.", "")
    let general_format = String
    let format = Object
    let api_data = Object
    for (let prefix of this.general_formats) {
      general_format = prefix + "@" + domain
      format = {
        company_name: company_name,
        format: general_format,
        type: this.type_identifiers.general,
        score: 0,
        is_valid: false,
        api_data: undefined
      }
      console.log("Calling API...")
      await axios.get(`https://emailverification.whoisxmlapi.com/api/v2?apiKey=${this.api_key}&emailAddress=${general_format}`).then((resp) => {
        format.api_data = resp.data
        if (resp.data.smtpCheck == 'true') {
          format.is_valid = true
          format.score = 100
        }
      })
      results.push(format)
      if (format.is_valid) {
        break
      }
    }
    return results
  };
  async get_format(company_name, website = undefined, {
    overwrite_undefined = false,
    api_calls = false
  } = {}) {

    let results = this.datastore.get("company_name", company_name, 30);
    if (!results.length) {
      results = await this.scrape_formats(company_name, website);
      if (results[0].format == undefined && website && api_calls) {
        results = await this.general_format(company_name, website)
      }
      this.datastore.multi_post(results);
    } else if (results[0].format == undefined && overwrite_undefined && website && api_calls) {
      const delete_id = results[0].id

      this.datastore.delete(delete_id)
      results = await this.general_format(company_name, website)
      this.datastore.multi_post(results)
    }
    if (results.length && results[0].format == undefined) {
      return undefined;
    } else {
      return results.filter(res => res.origin == 'rocketreach').sort(function (a, b) {
          return (a.score > b.score) ? -1 : ((b.score > a.score) ? 1 : 0)
        })[0] ||
        results.filter(res => res.origin == 'signalhire').sort(function (a, b) {
          return (a.score > b.score) ? -1 : ((b.score > a.score) ? 1 : 0)
        })[0] ||
        results.filter(res => res.type == 'general' && res.is_valid == true)[0] || undefined;
    };
  };
  async scrape_formats(company_name, website = undefined, opt = {
    api_calls: false
  }) {
    // Check that company name is given:
    if (company_name == undefined) {
      throw "Company name not given."
    }
    // Extract website domain if given:
    const website_domain = website ? website.split("//")[1].split("/")[0].replace("www.", "").split(".")[0] : undefined
    // Remove chars for clean comparison:
    const remove_lite = ["(", ")", "{", "}", " '", "' ", "'"];
    const remove_full = ["CORP", "INC", "LTD", "LLC", /\([^()]*\)/g, "(", ")", "{", "}", "'", ".", ",", " ", "-",
      "AGENCY", "TECHNOLOGIES", "SOLUTIONS", "SERVICES", "CORPORATION", "CONSULTING", "GROUP", "SYSTEMS", "TECHNOLOGY", "PARTNERS", /[^a-zA-Z\d\s:\u00C0-\u00FF]/g
    ];
    // Get search results from google:
    console.log("Searching for email formats...");
    const search_query = (website_domain ? '"' + website_domain + '"' : company_name.replaceAll(" ", "+")) + '+email+format';
    const search_results = await this.scrape(this.google_config, {
      field_1: search_query
    });
    // Scrape relavent pages: 
    let scraped_formats = []
    let title, compare_title, compare_name, description = ""
    for (let res of search_results) {
      if (res.description && res.title) {
        title = res.title.toUpperCase();
        compare_title = this.format_string(title.split("EMAIL FORMAT")[0].split(":")[0], remove_full);
        compare_name = this.format_string(company_name.toUpperCase().split(":")[0], remove_full);
        description = res.description.toUpperCase()
        if (compare_title == compare_name && title.includes("EMAIL FORMAT") && !description.includes("0 EMAIL FORMATS")) {
          if (res.url.includes("rocketreach")) {
            scraped_formats.push(...(await this.scrape(this.rocket_config, {
              url: res.url
            })));
          } else if (res.url.includes("signalhire")) {
            scraped_formats.push(...(await this.scrape(this.signalhire_config, {
              url: res.url
            })));
          }
          /**else if (res.url.includes("webspotter")){
                     scraped_formats.push(...(await this.scrape(this.webspotter_config, {url: res.url})).map(function(obj){obj.origin = "webspotter"; return obj}));
                   };  ### Detrimental bug with selectors selecting unwanted data. No uniqness among js selectors on webspotters.com. */
        };
      };
    };
    // Format formats into usable form:
    const formatted_formats = scraped_formats.map(format => {
      if (format.format && !format.format.includes("//")) {
        const email_domain = format.format.split("@")[1];
        if (website_domain ? website_domain == email_domain.split(".")[0] : true) {
          const user_format = format.format
            .split("@")[0]
            .toUpperCase()
            .replaceAll("{", "")
            .replaceAll("}", "")
            .replace("FIRST", this.format_identifiers.first_name)
            .replace("LAST", this.format_identifiers.last_name)
            .replace("F", this.format_identifiers.first_initial)
            .replace("L", this.format_identifiers.last_initial)
            .replace("JANE", this.format_identifiers.first_name)
            .replace("JOHN", this.format_identifiers.first_name)
            .replace("J", this.format_identifiers.first_initial)
            .replace("DOE", this.format_identifiers.last_name)
            .replace("D", this.format_identifiers.last_initial);
          // Putting email together:
          format.format = (user_format + "@" + email_domain).toLowerCase();
          format.score = parseInt(format.score)
          format.company_name = company_name
          format.type = this.type_identifiers.personal
        } else {
          return undefined
        }
      } else {
        return undefined
      }
      return format
    }).filter(Boolean)
    return formatted_formats.length ? formatted_formats : [{
      company_name: company_name,
      format: undefined
    }]
  };
  format_string(string, args) {
    string = string.toUpperCase();
    args.forEach(arg => string = string.replaceAll(arg, ""));
    return string.trim();
  };
  extract_emails(text) {
    return text.match(/(?:[a-z0-9+!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/gi);
  };
};
// Uses child processes of linkedin and indeed to scrape jobs in parallel
class JobBot extends Puppet {
  constructor(devMode, {
    scrape_linkedin = true,
    scrape_indeed = true
  } = {}) {
    super(devMode, undefined)

    this.indeed_config = {
      navigation_delay: 50000,
      action_delay: 15000,
      initial_url: "https://ca.indeed.com/",
      search_url: "https://ca.indeed.com/jobs?q=field_1&l=field_2&start=0",
      card_sel: ".jobsearch-ResultsList > li",
      card_fields: {
        posting: [".jobTitle", "innerText"],
        company_name: [".companyName", "innerText"],
        location: [".companyLocation", "innerText"],
        posting_date: [".date", "innerText"]
      },
      origin: "indeed"
    };

    this.linkedin_config = {
      navigation_delay: 50000,
      action_delay: 15000,
      initial_url: "https://www.linkedin.com",
      search_url: "https://www.linkedin.com/jobs/search?keywords=field_1&location=field_2&start=25",
      card_sel: ".base-card",
      card_fields: {
        posting: [".base-search-card__title", "innerText"],
        company_name: [".hidden-nested-link", "innerText"],
        location: [".job-search-card__location", "innerText"],
        posting_date: [".job-search-card__listdate", "innerText"],
        linkedin_url: [".hidden-nested-link", "href"]
      },
      origin: "linkedin"
    };

    this.scrape_linkedin = scrape_linkedin;
    this.scrape_indeed = scrape_indeed;

    this.scraped_postings_file = "./files/scraped_postings.json";
    this.scraped_postings = new DataStore(this.scraped_postings_file);
    this.scraped_companies_file = "./files/scraped_companies.json";
    this.scraped_companies = new DataStore(this.scraped_companies_file);
    this.newly_scraped_companies_file = "./files/newly_scraped_companies.json";
    this.newly_scraped_companies = new DataStore(this.newly_scraped_companies_file);

    const canada_locations = ["Calgary Alberta Canada", "Edmonton Alberta Canada", "Vancouver British Columbia Canada", "Winnipeg Manitoba Canada", "Victoria British Columbia", "Saskatoon Saskatchwan Canada", "Regina Saskatchewan Canada", "Toronto Ontario Canada", "Montreal, Quebec, Canada", "Halifax, Nova Scotia, Canada", "Quebec City, Quebec, Canada", "Hamilton, Ontario, Canada", "New Brunswick Canada"];
    const united_states_locations = ["Atlanta, GA", "Austin, TX", "Boston, MA", "Chicago, IL", "Houston, TX", , "Colorado, CO", "Dallas-Ft. Worth, TX", "Los Angeles, CA", "New York City, NY", "San Francisco, CA", "Seattle, WA", "Washington, D.C."];
    this.locations = canada_locations.concat(united_states_locations);
    this.keywords = ["Frontend Developer", "Backend Developer", "Devops Developer", "Full Stack Web Developer", "Full Stack App Developer", "Programmer", "Python Developer", "React Developer", "Node JS Developer", "Ruby Developer", "Data Scientist", "Cloud Developer"];
  };
  async init() {
    if (this.scrape_linkedin) {
      this.linkedin_bot = new Puppet(this.devMode, this.linkedin_config);
      await this.linkedin_bot.init();
    };
    if (this.scrape_indeed) {
      this.indeed_bot = new Puppet(this.devMode, this.indeed_config);
      await this.indeed_bot.init();
    };
  };

  async scrape_companies(locations = this.locations, keywords = this.keywords) {
    for (let location of locations) {
      for (let keyword of keywords) {
        console.log(`Searching for ${keyword} in ${location}...`);

        const indeed_results = new Promise((resolve) => {
          if (this.scrape_indeed) {
            resolve(this.indeed_bot.scrape({
              field_1: keyword,
              field_2: location
            }));
          } else {
            resolve([]);
          };
        });

        const linkedin_results = new Promise((resolve) => {
          if (this.scrape_linkedin) {
            resolve(this.linkedin_bot.scrape({
              field_1: keyword,
              field_2: location
            }));
          } else {
            resolve([]);
          };
        });

        let new_companies = []

        await Promise.all([indeed_results, linkedin_results]).then((results) => {

          results = results.flat()
          
          new_companies = this.scraped_companies.multi_post(results, ['company_name'])
          this.newly_scraped_companies.multi_post(new_companies)
          this.scraped_postings.multi_post(results, ['company_name', 'posting', 'origin'])
          console.log(new_companies)
          
        });
      };
    };
    await this.quit();
    console.log("Finished");
  };
  async quit() {
    if (this.scrape_linkedin) {
      await this.linkedin_bot.quit();
    };
    if (this.scrape_indeed) {
      await this.indeed_bot.quit();
    };
  };
};
function delay(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time);
  });
};
module.exports = {
  Puppet: Puppet,
  EmailBot: EmailBot,
  DataStore: DataStore,
  JobBot: JobBot,
};