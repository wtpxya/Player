/* Milovana.com Resource File - Copyright 2006-2022 Milovana.com !modified*/
jQuery(function () {
  var iframe = document.getElementsByClassName('eosIframe')[0]
  var script
  var rpcMethods = {
    load: function (params) {
      var searchParams = new URLSearchParams(window.location.search)
      var teaseId = Number(document.body.getAttribute('data-tease-id'))
      var title = document.body.getAttribute('data-title')
      var author = document.body.getAttribute('data-author')
      var preview = document.body.getAttribute('data-preview') === 'true' || searchParams.has('preview')
      var key = document.body.getAttribute('data-key')
      return getUploadedJson().then(function (json) {
        if (json.hasOwnProperty("oeosmeta")) {
          if (json["oeosmeta"].hasOwnProperty("typ") && json['oeosmeta']['typ'] == 'classic') {
            alert("Classic Teases are not supported")
            location.reload();
          }
          if (json["oeosmeta"].hasOwnProperty("title")) {
            title = json['oeosmeta']['title'];
          }
          if (json["oeosmeta"].hasOwnProperty("teaseId")) {
            teaseId = json['oeosmeta']['teaseId'];
          }
          if (json["oeosmeta"].hasOwnProperty("author")) {
            author = json['oeosmeta']['author'];
          }
        }
        document.title = title
        script = json
        return { title: title, author: author, script: script, preview: preview }
      })
    }, queryMedia: function (params) {
      var authorId = Number(document.body.getAttribute('data-author-id'))
      var teaseId = Number(document.body.getAttribute('data-tease-id'))
      var locator = params.locator
      var size = params.size
      var type = params.type
      var wildcard = locator.indexOf('*') !== -1
      return fetch('/media/query.php' + '?url=' + encodeURIComponent(locator) + '&size=' + encodeURIComponent(size) + '&type=' + encodeURIComponent(type) + '&context=timg://' + authorId + '/' + teaseId + '/' + (wildcard ? '&random=' + Math.random() : '')).then(function (res) { return res.json() })
    }, goToAuthor: function () {
      var authorId = Number(document.body.getAttribute('data-author-id'))
      /*window.location.href='/webteases/?author='+authorId*/
      return !0
    }, loadStorage: function () {
      var teaseId = Number(document.body.getAttribute('data-tease-id'))
      var isLoggedIn = document.body.getAttribute('data-is-logged-in') === 'true'
      if (!script) { throw new Error('script has not been loaded yet') }
      if (!script.modules || !script.modules.storage) { throw new Error('storage module is not enabled for this script') }
      if (isLoggedIn) {
        return Promise.resolve(jQuery.ajax({
          type: 'POST', url: '/graphql/', contentType: 'application/json', data: JSON.stringify({
            query: `query ($teaseId: ID!) {
              loadTeaseStorage(teaseId: $teaseId) {
                data
              }
            }`, variables: { teaseId: teaseId }
          })
        })).then(function (response) { return response.data.loadTeaseStorage.data })
      } else { return localStorage['teaseStorage_' + teaseId] || '{}' }
    }, saveStorage: function (params) {
      var teaseId = Number(document.body.getAttribute('data-tease-id'))
      var isLoggedIn = document.body.getAttribute('data-is-logged-in') === 'true'
      if (!script) { throw new Error('script has not been loaded yet') }
      if (!script.modules || !script.modules.storage) { throw new Error('storage module is not enabled for this script') }
      if (isLoggedIn) {
        return Promise.resolve(jQuery.ajax({
          type: 'POST', url: '/graphql/', contentType: 'application/json', data: JSON.stringify({
            query: `mutation ($teaseId: ID!, $data: String!) {
              saveTeaseStorage(teaseId: $teaseId, data: $data)
            }`, variables: { teaseId: teaseId, data: params.state }
          })
        })).then(function () { return !0 })
      } else {
        localStorage['teaseStorage_' + teaseId] = params.state
        return !0
      }
    }, openRatingDialog: function () {
      var dialog = document.getElementById('eosRatingDialog')
      var isLoggedIn = document.body.getAttribute('data-is-logged-in') === 'true'
      dialog.style.display = 'flex'
      var messageEl = document.querySelector('.eosRatingDialog .message')
      messageEl.innerHTML = 'Thanks for playing!<br><br>'
        + '<div style="font-size: 80%">You can '
        + '<a style="color:white" href="#" onclick="window.location.reload()">reload</a> if you want.</div>'
      /*
      if (!isLoggedIn) {
        var messageEl = document.querySelector('.eosRatingDialog .message')
        messageEl.innerHTML = 'In order to rate this tease, you need to be logged in first.'
      }
      */
      return !0
    }
  }

  // External save export/import bridge. Uses the same storage methods as the game.
  window.EOSSaveManager = {
    exportData: function () {
      return Promise.resolve(rpcMethods.loadStorage()).then(function (state) {
        return {
          format: 'tease-player-save',
          version: 1,
          teaseId: Number(document.body.getAttribute('data-tease-id')),
          title: document.body.getAttribute('data-title') || document.title,
          exportedAt: new Date().toISOString(),
          state: typeof state === 'string' ? state : JSON.stringify(state)
        };
      });
    },
    importData: function (backup) {
      if (!script || !script.modules || !script.modules.storage) {
        return Promise.reject(new Error('Le jeu ne prend pas en charge la sauvegarde.'));
      }
      if (!backup || backup.format !== 'tease-player-save' || backup.version !== 1 ||
          typeof backup.state !== 'string' || typeof backup.teaseId !== 'number') {
        return Promise.reject(new Error('Fichier de sauvegarde invalide.'));
      }
      var id = Number(document.body.getAttribute('data-tease-id'));
      if (backup.teaseId !== id) return Promise.reject(new Error('Cette sauvegarde appartient à un autre jeu.'));
      try {
        var parsed = JSON.parse(backup.state);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid');
      } catch (e) {
        return Promise.reject(new Error('Les données de sauvegarde sont endommagées.'));
      }
      return Promise.resolve(rpcMethods.loadStorage()).then(function (current) {
        var copy = {
          format: 'tease-player-save', version: 1, teaseId: id,
          title: document.title, exportedAt: new Date().toISOString(),
          state: typeof current === 'string' ? current : JSON.stringify(current)
        };
        try { localStorage.setItem('tease-player-pre-import-backup-' + id, JSON.stringify(copy)); } catch (e) {}
        return rpcMethods.saveStorage({ state: backup.state });
      });
    }
  };

  function bindExternalSaveButtons() {
    var exportButton = document.getElementById('exportSaveButton');
    var importButton = document.getElementById('importSaveButton');
    var input = document.getElementById('saveImportInput');
    var status = document.getElementById('saveStatus');
    if (!exportButton || !importButton || !input || !status) return;
    function report(message) { status.textContent = message; }
    exportButton.addEventListener('click', function () {
      report('Préparation de la sauvegarde…');
      window.EOSSaveManager.exportData().then(function (data) {
        var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = 'sauvegarde-' + data.teaseId + '.json';
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        report('Export terminé. Vérifie le fichier dans Fichiers.');
      }).catch(function (error) { report(error.message || 'Erreur pendant l’export.'); });
    });
    importButton.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var backup = JSON.parse(reader.result);
          if (!window.confirm('Importer cette sauvegarde remplacera la progression actuelle. Continuer ?')) { input.value = ''; return; }
          report('Vérification et importation…');
          window.EOSSaveManager.importData(backup).then(function () {
            report('Import réussi. Recharge le jeu pour retrouver la progression.');
          }).catch(function (error) { report(error.message || 'Import impossible.'); });
        } catch (error) { report('Fichier JSON illisible.'); }
        input.value = '';
      };
      reader.onerror = function () { report('Impossible de lire ce fichier.'); input.value = ''; };
      reader.readAsText(file);
    });
  }
  bindExternalSaveButtons();

  window.addEventListener('message', function (event) {
    if (event.source !== iframe.contentWindow) {
      console.error('Received message from unknown source, ignoring')
      return
    }
    var method = event.data.method
    var params = event.data.params
    var id = event.data.id
    if (Object.keys(rpcMethods).indexOf(method) === -1) {
      console.error('Unknown rpc method "' + method + '"')
      return
    }
    Promise.resolve(rpcMethods[method](params)).then(function (result) { iframe.contentWindow.postMessage({ jsonrpc: '2.0', result: result, id: id }, '*') }).catch(function (error) { iframe.contentWindow.postMessage({ jsonrpc: '2.0', error: { message: error.message }, id: id }, '*') })
  })
  document.querySelector('.eosRatingDialog').addEventListener('click', function (e) {
    if (e.currentTarget !== e.target) { return }
    document.querySelector('.eosRatingDialog').style.display = 'none'
  })
  document.querySelector('.eosRatingDialog .close').addEventListener('click', function () { document.querySelector('.eosRatingDialog').style.display = 'none' })
  var teaseId = Number(document.body.getAttribute('data-tease-id'))
  var starButtons = document.querySelectorAll('.eosRatingDialog .star.rating')
  for (var i = 0; i < starButtons.length; i++) {
    starButtons[i].addEventListener('click', function (e) {
      var rating = e.currentTarget.dataset.rating
      var starsEl = document.querySelector('.eosRatingDialog .stars')
      starsEl.style.display = 'none'
      var messageEl = document.querySelector('.eosRatingDialog .message')
      messageEl.innerHTML = 'Loading...'
      fetch('/graphql/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: 'mutation { rateTease(teaseId: ' + teaseId + ', rating: ' + rating + ') { id } }' }) }).then(function (res) { return res.json() }).then(function (json) { if (json.data) { messageEl.innerHTML = 'Thanks for submitting your rating!' } else { messageEl.innerHTML = 'Sorry, an error occurred. Please try again later.' } })
    })
  }
})