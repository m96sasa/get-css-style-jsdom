const express = require('express');
const bodyparser = require('body-parser');
const request = require("request");
const fs = require('fs');
const path = require('path');
const jsdom = require('jsdom');
const http = require('http');
const https = require('https');
const {JSDOM} = jsdom;


const app = express();
const server = require('http').Server(app);

var port = 8081;
var router = express.Router();
var basePath = path.join(__dirname, 'external');
if (!fs.existsSync(basePath)){
    fs.mkdirSync(basePath);
}

app.use(bodyparser.urlencoded({extended:true}));
app.use(bodyparser.json({ type: 'application/json' }));

const getRequest = (url) => {
    return new Promise((resolve, reject) => {
        if (url !== undefined && url !== null && url.indexOf('https://') !== -1) {
            https.get(url, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('error', () => {
                    resolve(null);
                });
                res.on('end', () => {
                    resolve(data);
                });
            });
        } else {
            http.get(url, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('error', () => {
                    resolve(null);
                });
                res.on('end', () => {
                    resolve(data);
                });
            });
        }
    });
}

router.post('/getstyle', async function(req, res) {
    let link = req.body.url;
    let elem = req.body.element;
    
    let dom = await JSDOM.fromURL(link);
    
    const link_elements = dom.window.document.querySelectorAll("link[href]");

    for (key in link_elements) {
        let item = link_elements[key];
        if (item.href != undefined && item.href.indexOf('.css') !== -1) {
            let url = item.href;
            let filename = url.substring(url.lastIndexOf('/')+1);
            let remove_str = filename.indexOf('.css');
            if (remove_str !== -1) filename = filename.replace(filename.substring(remove_str+4), "");
            let style_body = await getRequest(url);
            while (true){
                let sInd = style_body.indexOf('@charset');
                if (sInd == -1) break;
                let lInd = style_body.indexOf(';', sInd);
                style_body = style_body.slice(0, sInd) + style_body.slice(lInd+1);
            }
            while (true){
                let sInd = style_body.indexOf('@import');
                if (sInd == -1) break;
                let lInd = style_body.indexOf(';', sInd);
                style_body = style_body.slice(0, sInd) + style_body.slice(lInd+1);
            }
            if (style_body == null || res.error !== undefined) continue;
            let absolutePath = path.join(basePath, filename);
            fs.writeFile(absolutePath, style_body, (err) => {
                if (err) {
                    res.status = 400;
                    res.json({errors:'Could not fetch stylesheet of external files.'});
                    return;
                }
            });
            let link_para = dom.window.document.createElement("link");
            link_para.rel = "stylesheet";
            link_para.href = `file://${absolutePath}`;
            dom.window.document.head.appendChild(link_para);
        }
    }

    const {window} = new JSDOM(dom.serialize(), {resources: 'usable'});
    
    var cssstyle = '';
    window.onload = function () {
        try {
            let para = window.document.evaluate(elem, window.document, null, window.XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            cssstyle = window.getComputedStyle(para).cssText;
            res.json({url: link, element: elem, style: `{${cssstyle}}`});
        } catch(error) {
            res.status(400);
            res.json({errors:'Could not parse your xPath element.'});
        }
    };
    
    setTimeout(() => {}, 1000);
});

app.use('/', router);

server.listen(port);
console.log('Server started on localhost: ' + port + ' ...');