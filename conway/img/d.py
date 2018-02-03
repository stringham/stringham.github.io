import os
import urllib

def get_pic(name, url):
	if not os.path.isfile(name+'.jpg'):
		print 'getting ' + name
		urllib.urlretrieve(url, name + '.jpg')


# for i in range(start,end+1):
# 	url = base + str(i).zfill(4)+'.jpg'
# 	get_pic(i-start+1, url)

for x in range(100):
	get_pic(str(x+1),'http://lorempixel.com/320/320/')