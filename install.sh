rm -rf gdrj
go build -o gdrj
echo '' > log.txt
sudo ./gdrj > log.txt &