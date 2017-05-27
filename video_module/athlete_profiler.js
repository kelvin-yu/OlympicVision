"use strict";
const utils = require('./utils.js');
const Athlete = require('./athlete.js');
const IMAGE_COUNT = 3;

//callback (err, athlete)
exports.getAthleteProfile = function getAthleteProfile(line, cb){
    utils.bingWebSearch(line + " olympic wikipedia", (bingErr, bingResponseCode, bingResponseBody) => {
        if(bingErr){
            console.log("Bing err", bingErr);
            cb(bingErr, null);
        }
        let person = utils.removeDiacritics(getAthleteName(JSON.parse(bingResponseBody)));
        if(person){
            utils.bingImageSearch(person + ' olympic', (bingImageErr, bingImageResponseCode, bingImageResponseBody) => {
                if(bingImageErr){
                    console.log('Bing Image Error' , bingImageErr);
                    cb(bingImageErr, null);
                }
                //console.log("person: ", person, " bingImageReponseBody", bingImageResponseBody);
                let images = getAthleteImages(JSON.parse(bingImageResponseBody));
                let athlete = new Athlete(line, person, images, getAthleteWikipedia(JSON.parse(bingResponseBody)));
                cb(null, athlete);
            });
        }
        else{
            cb(null, false);
        }
    });
};

function getAthleteImages(body){
    let images = [];
    if(body && body['value']){
        for(let i = 0; i < IMAGE_COUNT && i < body['value'].length; i++){
            images.push(body['value'][i]['contentUrl']);
        }
    }
    return images;
}


function getAthleteName(body){
    if(!body
        || !body['webPages']
        || !body['webPages']['value']
        || !body['webPages']['value'][0]
        || !body['webPages']['value'][0]['name']
        || body['webPages']['value'][0]['name'].toUpperCase().indexOf('WIKIPEDIA') === -1) return false;

    return body['webPages']['value'][0]['name'].split(' -')[0];
}

function getAthleteWikipedia(body){
    if(!body
        || !body['webPages']
        || !body['webPages']['value']
        || !body['webPages']['value'][0]
        || !body['webPages']['value'][0]['name']
        || !body['webPages']['value'][0]['url']
        || body['webPages']['value'][0]['name'].toUpperCase().indexOf('WIKIPEDIA') === -1) return false;

    return body['webPages']['value'][0]['url'];
}