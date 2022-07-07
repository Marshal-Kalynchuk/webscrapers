# webscrapers
Contains a library of scrapers and data transformation tools to help with client acquisition.

# Guide:
In order for the scripts to work, you must have read/write locations for the various data types.
They are:

The text files contain copy pasted data from the linkedin sales navigator leads lists. They are
used by the scripts to extract company and contact data that is stored in json files.

    imported_companies
    companies_text

    imported_contacts
    contacts_text


The linkedin_match_file is downloadable after importing a csv of companies into the linkedin sales 
navigator. It is used to apply website urls to the contacts.

    linkedin_match_results


The email_templates_file is used to store information about the email template of each company. It is used
to generate emails for the contacts. If it doesn't have the email template for a given contact, the email bot will
search of it on google. If it find a template, it will apply it to the contact and save the template to email_templates.

    email_templates


The unique_companies file contains all of the unique companies scraped by the scraper bots. It is also updated with additional data
when the copy pasted data is read or the match results are read. The new_companies file contains the new companies that the scrapers 
have found. Use this as the import into linkedin for batch processing. Delete after. 
    
    all_unique_companies
    new_unique_companies


The good / bad companies files contain the results of filtering the companies_save_file. Import the good_companies into 
the linkedin sales navigator to save the contacts.
    
    filtered_companies
    new_good_companies


The all_unique_contacts files log all of the contacts that have been processed. The working_contacts contains the contacts 
that have had a email recently generated for them. Delete after processing.

    all_unique_contacts
    new_unique_contacts


A overview of the process:

    - Scrape websites   
        (Add new companies)
    > POST: all_companies 
    > POST: new_companies

    - Upload new_companies to sales navigator 
        and download linkedin match report.

    - Process linkedin_match_report
        (Update existing companies or add new companies)
        (Update website_url, linkedin_url)
    > POST: all_companies

    - Copy Paste and process companies
        (Update existing companies or add new companies)
        (Update company_size, company_industry)
    > POST: all_companies

    - Filter companies
        (Update existing companies)
        (Update company_status and add newly filtered to new_good_companies)
    > POST: all_companies
    > POST: new_good_companies

    - Upload new_good_companies to sales navigator 
        and save contacts.

    - Copy Paste and Process contacts
        (Update existing contacts or add new contacts)
    > POST: all_contacts
        (If contact has just met passing criteria, add to new_contacts)
    > POST: new_contacts

    -Upload new_contacts to HubSpot
