# Migration service for BackKit


## install

```
npm install --save	https://github.com/backkit/migrate.git \
					https://github.com/backkit/winston.git \
					https://github.com/backkit/config.git
```

## list existing migrations

```
LOG_FORMAT=flat ENTRYPOINT=migrate node index.js ls
```

## migrate up

```
LOG_FORMAT=flat ENTRYPOINT=migrate node index.js up
```

## migrate down

```
LOG_FORMAT=flat ENTRYPOINT=migrate node index.js down
```

## create new migration

```
LOG_FORMAT=flat ENTRYPOINT=migrate node index.js new
```

...with a title:

```
LOG_FORMAT=flat ENTRYPOINT=migrate node index.js new "test upgrade schema"
```