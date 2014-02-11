mirrorify
=========

lazy npm static file mirror

## what

So, I'm experimenting with powering `npm install` with static http mirrors. It's a bit painful to get all the tarballs downloaded into a static dir... it's not too bad to mirror a couch database and lazily download the tarballs into a static dir though.

## running

Configure mirrorify with ENV variables.

`COUCHDB_URI` - a couch endpoint to query when a request comes in for a module that we don't yet hae
`COUCHDB_DATABASE` - the couch database to query
`DIRECTORY` - where to download the tarballs from the couch database for caching future requests

## api

### `GET /:module`

Get a list of tarball files for the module (use this to determine which versions of a module are available)

returns `200`

```javascript
{
  files: [
    "#{module}-#{version}"
  ]
}
```

### `GET /:module/:filename`

Get a specific module's tarball.

returns `200` with tarball content
