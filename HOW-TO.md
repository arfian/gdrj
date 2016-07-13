### how to update development platform

 1. ssh to `go.eaciit.com`, go to dev path

	```bash
	ssh developer@go.eaciit.com -i ~/Downloads/developer.pem
	cd $GOPATH/src/eaciit/gdrj
	```

 2. pull latest changes of master branch, kill previous app, rebuild

	```bash
	git pull origin master
	sudo lsof -i :8030 # then get the pid, example pid is 63651
	sudo kill -9 63651
	./install.sh
	```


### how to update production platform

> ==== NOTE ==== <br /><br />All *.go files inside `$GOPATH/src/eaciit/gdrjprod` use the old import from `github.com/eaciit/gdrj`. So make sure when you are going to update the production platform, update the development platform first.

 1. create new branch

	```bash
	git branch prodjul12
	git checkout prodjul12
	```

 2. make changes on file `config/databases.json`

	```json
	    "_id": "db_acl",
	    "data": {
	        "db": "ecgodrej_prod",
	```
	
	```json
	    "_id": "db_godrej",
	    "data": {
	        "db": "ecgodrej_prod",
	```

 3. change the port on file `config/port.json`

	```json
	[{"_id":"port","port":8029}]
	```

 4. make some changes on the installer file, `install.sh`

	```bash
	rm -rf gdrj
	go build -o gdrj
	echo '' > log.txt
	sudo ./gdrj > log.txt &
	```

 5. ssh to `go.eaciit.com`, go to prod path

	```bash
	ssh developer@go.eaciit.com -i ~/Downloads/developer.pem
	cd $GOPATH/src/eaciit/gdrjprod
	```

 6. kill previous running app

	```bash
	sudo lsof -i :8029 # then get the pid, example pid is 63651
	sudo kill -9 63651
	```

 7. pull the brance, use it, then build

	```bash
	git pull origin prodjul12
	git checkout prodjul12
	./install.sh
	```

 8. check on log

	```bash
	tail -f log.txt
	```
