const { v4: uuidv4, validate: validate_uuid} = require('uuid');
const ws = require('ws');
const path = require('path')
var express = require('express')
var cookieParser = require('cookie-parser')

var app = express()
app.set('views', './views')
app.set('view engine', 'pug')
app.use(cookieParser())
app.use(express.static(path.join(__dirname, 'public')));

// aggregate all body data
// probably not the most efficient but it works
app.use (function(req, res, next) {
    var data='';
    req.setEncoding('utf8');
    req.on('data', function(chunk) { 
       data += chunk;
    });

    req.on('end', function() {
        req.body = data;
        next();
    });
});

const important = ['url', 'method', 'rawHeaders', 'body']
app.use(function (req, res) {
	// remove extra forward slashes
	let uuid = req.url.replace(/^\/+|\/+$/g, '').split('/')[0];
	if (validate_uuid(uuid)) {
		if (uuid in backends) {
			res.cookie('uuid', uuid)
			res.render('backend', { uuid })
		} else {
			res.render('error', { url_uuid: uuid, cookie_uuid: req.cookies.uuid })
		}
	} else if (req.cookies.uuid in backends) {
		let backend = backends[req.cookies.uuid]
		new_req = {}
		for (let prop of important) {
			new_req[prop] = req[prop]
		}
		new_req.req_id = uuidv4()
		while (new_req.req_id in backend.reqs) {
			new_req.req_id = uuidv4()
		}
		backend.reqs[new_req.req_id] = res
		backend.socket.send(JSON.stringify(new_req))
	} else {
		res.render('error', { url_uuid: false, cookie_uuid: req.cookies.uuid })
	}
})

backends = {}

const port = 80
let server = app.listen(port);
console.log('listening on port ' + port + '...')

const ws_server = new ws.Server({ server });
ws_server.on('connection', socket => {
	let uuid = uuidv4();
	// as if we'd ever get a collision
	while (uuid in backends) {
		uuid = uuidv4();
	}
	backends[uuid] = { socket, reqs: {} }
	// console.log('new backend:', uuid)
	// console.log('current backends:', Object.keys(backends))
	socket.send(JSON.stringify({uuid}))
	socket.on('message', data => {
		let payload = JSON.parse(data)
		let res = backends[uuid].reqs[payload.req_id]
		let body = Buffer.from(payload.body)
		res.set(payload.headers)
		res.status(payload.status)
		res.end(body)
		delete backends[uuid].reqs[payload.req_id]
	})
	socket.on('close', () => {
		delete backends[uuid]
		console.log('backend disconnected:', uuid)
		console.log('current backends:', Object.keys(backends))
	})
});
