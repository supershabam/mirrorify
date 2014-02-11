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
      resolve(files)
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

files('2').then(console.log, console.error)
