const cheerio = require('cheerio');
const fs      = require('fs');
const Promise = require("bluebird");
const rp      = require('request-promise');
const baseUrl = 'https://www.bankmega.com/promolainnya.php';

Promise.promisifyAll(require("request"));

let allPromosByCategory = {};
let categories = [];

// this using recursion method to scrap with pagination
const getPromo = async (subcat = 1, page = 1) => {
  url = `${baseUrl}?subcat=${subcat}&page=${page}`;
  console.log(`request to url ${url}`);  

  const options = {
      uri: url,
      transform: function (body) {
        return cheerio.load(body);
      }
  }; 
  
  try {    
    const $ = await rp(options)

    const totalCategory = $('#subcatpromo').find('img').length;

    // one time setup for categories
    if (subcat === 1 && page === 1) {
      $('#subcatpromo').find('img').each((idxPromo, img) => {
        categories.push(img.attribs.id);
        allPromosByCategory[img.attribs.id] = [];
      });
    }

    // If there is promo exists, then put all detail url to array
    const imagePromo    = $('#imgClass');
    if (imagePromo.length > 0) {
      const arrDetailPromise = [];
      imagePromo.each((i, img) => {
        let optionsDetail = {
          uri: `https://www.bankmega.com/${img.parent.attribs.href}`,
          transform: function(body) {
            return cheerio.load(body)
          }
        }

        arrDetailPromise.push(rp(optionsDetail));
      });

      // Execute all detail url to get detail data
      await Promise.all(arrDetailPromise)
        .then(details => {
            details.map(detail => {
              const title   = detail(".titleinside h3").text();
              const imgUrl  = detail(".keteranganinside img").attr("src");
              const area    = detail(".area b").text();
              const periode = detail(".periode b").eq(0).text() + detail(".periode b").eq(1).text();

              // Put object promo to their own category
              allPromosByCategory[categories[subcat-1]].push({
                title,
                imgUrl,
                area,
                periode
              })
            });
        })
        .catch(errFetchDetail => {
          console.log({errFetchDetail});
        });

      page++;
      return getPromo(subcat, page);
    }else if(subcat < totalCategory) {
      console.log(`============== Next Category==============`);
      subcat++;
      return getPromo(subcat, 1);
    }else {
      console.log(allPromosByCategory);
      const dataSaved = JSON.stringify(allPromosByCategory, null, 2);
      fs.writeFile('solution.json',dataSaved,'utf-8', () => {
          console.log('Saved to solution.json');
      });
      return `******** Scraping is done *********`;  
    }
  } catch (error) {
    return error;
  }
}

getPromo()
  .then(promos => {
    console.log(promos);
  })
  .catch(err => {
    console.log(err);
  });