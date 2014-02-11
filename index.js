var express = require('express')
var fs = require('fs')
var glob = require('glob')
var mkdirp = require('mkdirp')
var nano = require('nano')
var path = require('path')
var RSVP = require('rsvp')

var Promise = RSVP.Promise
var app = express()
var couch = nano(process.env.COUCHDB_URI || 'http://localhost:5984')
var registry = couch.use(process.env.COUCHDB_DATABASE || 'registry')
var directory = process.env.DIRECTORY || path.resolve(process.cwd(), './data')
var port = process.env.PORT || 8080

app.use(express.logger())

function files(module) {
  return directoryFiles(module).catch(function(err) {
    return fetchCouchAttachments(module).then(function() {
      return directoryFiles(module)
    })
  })
}

function fileStream(module, filename) {
  return new Promise(function(resolve, reject) {
    var file = path.resolve(directory, module + '/' + filename)
    fs.exists(file, function(exists) {
      if (!exists) {
        return reject(new Error('file does not exist'))
      }
      resolve(fs.createReadStream(file))
    })
  })
}

function downloadAttachment(module, attachment) {
  return new Promise(function(resolve, reject) {
    var dir = path.resolve(directory, module)
    mkdirp(dir, function(err) {
      if (err) {
        return reject(err)
      }
      var file = dir + '/' + attachment
      var stream = registry.attachment.get(module, attachment)
      stream.pipe(fs.createWriteStream(file))
      stream.on('end', resolve)
      stream.on('error', reject)
    })
  })
}

function fetchCouchAttachments(module) {
  return new Promise(function(resolve, reject) {
    registry.get(module, function(err, doc) {
      if (err) {
        return reject(err)
      }
      if (!doc) {
        return reject(new Error('could not find module in registry ' + module))
      }
      var promises = Object.keys(doc._attachments).map(function(attachment) {
        return downloadAttachment(module, attachment)
      })
      resolve(Promise.all(promises))
    })
  })
}

function directoryFiles(module) {
  return new Promise(function(resolve, reject) {
    var match = path.resolve(directory, module) + '/*.tgz' // todo sanitize path
    glob(match, function(err, files) {
      if (err) {
        return reject(err)
      }
      if (files.length === 0) {
        return reject(new Error('found no files for module ' + module))
      }
      resolve(files.map(function(file) {
        return path.basename(file)
      }))
    })
  })
}

app.param('module', function(req, res, next, module) {
  req.module = module
  files(module).then(function(files) {
    req.files = files
    next()
  }, next)
})

app.get('/favicon.ico', function(req, res, next) {
  res.send(201)
})

app.get('/:module', function(req, res, next) {
  res.json({
    files: req.files
  })
})

app.get('/:module/:file', function(req, res, next) {
  fileStream(req.module, req.params.file).then(function(stream) {
    stream.pipe(res)
  }, next)
})

app.listen(port)
