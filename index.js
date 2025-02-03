import axios from "axios";
import * as cheerio from "cheerio"
async function scrapeWebpage(url = "") {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const pageHead = $('head').html();
    const pageBody = $('body').html();
    let externalLinks = [];
    let internalLinks = [];
    $('a').each((_, el) => {
        const link = $(el).attr('href')
        if (link == '/') return;
        if (link.startsWith('http') || link.startsWith('https')) {
            externalLinks.push(link)
        } else {
            internalLinks.push(link)
        }
    })
    return { head: pageHead, body: pageBody, internalLinks, externalLinks }
}

let { head, body, internalLinks, externalLinks } =await scrapeWebpage("https://piyushgarg.dev")
console.log(head, body, internalLinks, externalLinks)