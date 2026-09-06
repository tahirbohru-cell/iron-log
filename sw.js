/* IRONLOG service worker.
   Nothing here talks to a server of mine. It only re-serves the files this phone already has.

   Strategy: answer from the cache first, then quietly refresh in the background. At the gym there
   may be no signal, and a set logged between two working sets must never wait on a network that
   is not there - so the app opens instantly, offline or not. The background refresh means a new
   copy uploaded to the host is fetched on one launch and shown on the next, without me having to
   ship a new service worker every time.

   VER is the cache name. Bumping it throws the old cache away on activate; you only need to bump
   it if a cached file must be re-fetched immediately rather than on the next launch. */
var VER='ironlog-v2';
var FILES=['./','./gym-tracker.html','./manifest.webmanifest','./icon.svg','./icon-180.png'];

self.addEventListener('install',function(e){
  e.waitUntil(
    caches.open(VER).then(function(c){
      /* one at a time, not addAll: addAll fails the whole install if a single file 404s, and both
         the directory index and the icon are allowed to be missing depending on the host */
      return Promise.all(FILES.map(function(u){
        return fetch(new Request(u,{cache:'reload'})).then(function(res){
          if(res&&res.ok)return c.put(u,res);
        })['catch'](function(){});
      }));
    }).then(function(){return self.skipWaiting()})
  );
});

self.addEventListener('activate',function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){return k===VER?null:caches.delete(k)}));
    }).then(function(){return self.clients.claim()})
  );
});

self.addEventListener('fetch',function(e){
  var r=e.request;
  if(r.method!=='GET')return;
  e.respondWith(
    caches.match(r,{ignoreSearch:true}).then(function(hit){
      var net=fetch(r).then(function(res){
        if(res&&res.ok&&res.type!=='opaque'){
          var copy=res.clone();
          caches.open(VER).then(function(c){return c.put(r,copy)})['catch'](function(){});
        }
        return res;
      });
      if(hit){
        /* keep the background refresh alive after the cached answer has been handed over */
        try{e.waitUntil(net['catch'](function(){}))}catch(x){}
        return hit;
      }
      return net['catch'](function(){
        /* offline and never cached: a page load still has to land on something readable.
           match() resolves undefined for a miss, and returning undefined from respondWith
           fails the navigation outright, so the miss needs its own answer. */
        if(r.mode==='navigate')return caches.match('./gym-tracker.html').then(function(m){
          return m||new Response('',{status:504,statusText:'offline'});
        });
        return new Response('',{status:504,statusText:'offline'});
      });
    })
  );
});
