import { generateEmails } from "./scripts.js";
import fs from 'fs'

async function main(){
    let contacts = JSON.parse(fs.readFileSync('./json_files/trialContacts.json'))
    contacts = await generateEmails(contacts)
    //const emails = await JSON.parse(JSON.stringify(contacts.map(a=>a.email)));
    //console.log(`The found emails are: ${emails}`)
}

main()