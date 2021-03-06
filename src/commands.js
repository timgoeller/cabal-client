const qr = require('qrcode')
const pump = require('pump')
const to = require('to2')
const strftime = require('strftime')

module.exports = {
  add: {
    help: () => 'add a cabal',
    alias: ['cabal'],
    call: (cabal, res, arg) => {
      if (arg === '') {
        res.info('Usage example: /add <cabalkey>')
        res.end()
      } else {
        cabal.client.addCabal(arg, (err) => {
          if (err) res.error(err)
          else res.end()
        })
      }
    }
  },
  new: {
    help: () => 'create a new cabal',
    call: (cabal, res, arg) => {
      cabal.client.createCabal((err) => {
        if (err) res.error(err)
        else res.end()
      })
    }
  },
  nick: {
    help: () => 'change your display name',
    alias: ['n'],
    call: (cabal, res, arg) => {
      if (arg === '') {
        res.info(cabal.user.name)
        return res.end()
      }
      cabal.publishNick(arg, (err) => {
        if (err) return res.error(err)
        res.info("you're now known as " + arg)
        res.end()
      })
    }
  },
  share: {
    help: () => 'print a cabal key with you as admin. useful for sending to friends',
    call: (cabal, res, arg) => {
      const adminkey = `cabal://${cabal.key}?admin=${cabal.user.key}`
      res.info(adminkey, { data: { adminkey } })
      res.end()
    }
  },
  ids: {
    help: () => 'toggle showing ids at the end of nicks. useful for moderation',
    call: (cabal, res, arg) => {
      cabal.showIds = !cabal.showIds
      res.info(`toggled identifiers ${cabal.showIds ? 'on' : 'off'}`)
      res.end()
    }
  },
  emote: {
    help: () => 'write an old-school text emote',
    alias: ['me'],
    call: (cabal, res, arg) => {
      cabal.publishMessage({
        type: 'chat/emote',
        content: {
          channel: cabal.channel,
          text: arg
        }
      }, {}, (err) => {
        if (err) res.error(err)
        else res.end()
      })
    }
  },
  say: {
    help: () => 'write a message to the current channel',
    call: (cabal, res, arg) => {
      cabal.publishMessage({
        type: 'chat/text',
        content: {
          channel: cabal.channel,
          text: arg || ''
        }
      }, {}, (err) => {
        if (err) res.error(err)
        else res.end()
      })
    }
  },
  names: {
    help: () => 'display the names of the currently online peers',
    call: (cabal, res, arg) => {
      var users = cabal.getUsers()
      var userkeys = Object.keys(users).map((key) => users[key]).sort(cmpUser)
      res.info('history of peers in cabal')
      userkeys.map((u) => {
        var username = u.name || 'conspirator'
        var spaces = ' '.repeat(15)
        var paddedName = (username + spaces).slice(0, spaces.length)
        res.info(`  ${paddedName} ${u.key}`)
      })
    }
  },
  channels: {
    help: () => "display the cabal's channels",
    call: (cabal, res, arg) => {
      var joinedChannels = cabal.getJoinedChannels()
      var channels = cabal.getChannels()
      res.info(`there are currently ${channels.length} channels `)
      channels.map((c) => {
        var topic = cabal.getTopic(c)
        var shortTopic = topic.length > 20 ? topic.slice(0, 40) + '..' : topic || ''
        var count = cabal.getChannelMembers(c).length
        var userPart = count ? `: ${count} ${count === 1 ? 'person' : 'people'}` : ''
        res.info({
          text: `  ${joinedChannels.includes(c) ? '*' : ' '} ${c}${userPart} ${shortTopic}`,
          channel: c,
          userCount: count,
          topic,
          joined: joinedChannels.includes(c)
        })
      })
      res.end()
    }
  },
  join: {
    help: () => 'join a new channel',
    alias: ['j'],
    call: (cabal, res, arg) => {
      arg = (arg.trim() || '').replace(/^#/, '')
      if (arg === '') arg = 'default'
      cabal.joinChannel(arg, (err) => {
        if (err) return res.error(err)
        cabal.focusChannel(arg)
        res.end()
      })
    }
  },
  leave: {
    help: () => 'leave a channel',
    alias: ['l', 'part'],
    call: (cabal, res, arg) => {
      arg = (arg || '').trim().replace(/^#/, '')
      if (arg === '!status') return
      /* TODO: update `cabal.channel` with next channel */
      cabal.leaveChannel(arg, (err) => {
        if (err) return res.error(err)
        res.end()
      })
    }
  },
  clear: {
    help: () => 'clear the current backscroll',
    call: (cabal, res, arg) => {
      cabal.client.clearStatusMessages()
      res.end()
    }
  },
  qr: {
    help: () => "generate a qr code with the current cabal's address",
    call: (cabal, res, arg) => {
      const cabalKey = `cabal://${cabal.key}`
      qr.toString(cabalKey, { type: 'terminal' }, (err, qrcode) => {
        if (err) return
        res.info(`QR code for ${cabalKey}\n\n${qrcode}`)
        res.end()
      })
    }
  },
  topic: {
    help: () => 'set the topic/description/`message of the day` for a channel',
    alias: ['motd'],
    call: (cabal, res, arg) => {
      cabal.publishChannelTopic(cabal.channel, arg, (err) => {
        if (err) res.error(err)
        else res.end()
      })
    }
  },
  whoami: {
    help: () => 'display your local user key',
    alias: ['key'],
    call: (cabal, res, arg) => {
      res.info('Local user key: ' + cabal.getLocalUser().key)
      res.end()
    }
  },
  whois: {
    help: () => 'display the public keys associated with the passed in nick',
    call: (cabal, res, arg) => {
      if (!arg) {
        res.info('usage: /whois <nick>')
        res.end()
        return
      }
      const users = cabal.getUsers()
      const whoisKeys = Object.keys(users).filter((k) => users[k].name && users[k].name === arg)
      res.info(`${arg}'s public keys:`)
      // list all of arg's public keys in list
      for (var key of whoisKeys) {
        res.info(`  ${key}`)
      }
      res.end()
    }
  },
  read: {
    help: () => 'show raw information about a message from a KEY@SEQ',
    call: (cabal, res, arg) => {
      var args = (arg || '').split(/\s+/)
      if (args[0].length === 0) {
        res.info('usage: /baninfo KEY@SEQ')
        return res.end()
      }
      cabal.core.getMessage(args[0], function (err, doc) {
        if (err) return res.error(err)
        res.info(Object.assign({}, doc, {
          text: JSON.stringify(doc, 2, null)
        }))
        res.end()
      })
    }
  },
  moderation: {
    help: () => 'display moderation help and commands',
    call: (cabal, res, arg) => {
      const baseCmds = ['hide', 'mod', 'admin']
      const extraCmds = ['ids', 'actions', 'roles', 'inspect']
      const debugCmds = ['flag', 'flags']
      res.info('moderation commands')
      res.info('\nbasic actions. the basic actions will be published to your log')
      res.info('USAGE /<cmd> NICK{.PUBKEY} {REASON...}')
      baseCmds.forEach((base) => {
        res.info(`/${base}: ${module.exports[base].help()}`)
        const reverse = `un${base}`
        res.info(`/${reverse}: ${module.exports[reverse].help()}`)
      })
      res.info('\nlisting applied moderation actions. local actions (i.e. not published)')
      baseCmds.forEach((base) => {
        const list = `${base}s`
        res.info(`/${list}: ${module.exports[list].help()}`)
      })
      res.info('\nadditional commands. local actions')
      extraCmds.forEach((cmd) => {
        res.info(`/${cmd}: ${module.exports[cmd].help()}`)
      })
      res.info('\ndebug commands')
      debugCmds.forEach((cmd) => {
        res.info(`/${cmd}: ${module.exports[cmd].help()}`)
      })
      res.end()
    }
  },
  hide: {
    help: () => 'hide a user from a channel or the whole cabal',
    call: (cabal, res, arg) => {
      flagCmd('hide', cabal, res, arg)
    }
  },
  unhide: {
    help: () => 'unhide a user from a channel or the whole cabal',
    call: (cabal, res, arg) => {
      flagCmd('unhide', cabal, res, arg)
    }
  },
  hides: {
    help: () => 'list hides',
    call: (cabal, res, arg) => {
      listCmd('hide', cabal, res, arg)
    }
  },
  block: {
    help: () => 'block a user',
    call: (cabal, res, arg) => {
      flagCmd('block', cabal, res, arg)
    }
  },
  unblock: {
    help: () => 'unblock a user',
    call: (cabal, res, arg) => {
      flagCmd('unblock', cabal, res, arg)
    }
  },
  blocks: {
    help: () => 'list blocks',
    call: (cabal, res, arg) => {
      listCmd('block', cabal, res, arg)
    }
  },
  mod: {
    help: () => 'add a user as a moderator',
    call: (cabal, res, arg) => {
      flagCmd('mod', cabal, res, arg)
    }
  },
  unmod: {
    help: () => 'remove a user as a moderator',
    call: (cabal, res, arg) => {
      flagCmd('unmod', cabal, res, arg)
    }
  },
  mods: {
    help: () => 'list mods',
    call: (cabal, res, arg) => {
      listCmd('mod', cabal, res, arg)
    }
  },
  admin: {
    help: () => 'add a user as an admin',
    call: (cabal, res, arg) => {
      flagCmd('admin', cabal, res, arg)
    }
  },
  unadmin: {
    help: () => 'remove a user as an admin',
    call: (cabal, res, arg) => {
      flagCmd('unadmin', cabal, res, arg)
    }
  },
  admins: {
    help: () => 'list admins',
    call: (cabal, res, arg) => {
      listCmd('admin', cabal, res, arg)
    }
  },
  actions: {
    help: () => 'print out a historic log of the moderation actions applied by you, and your active moderators & admins',
    call: (cabal, res, arg) => {
	  const promises = [cabal.moderation.getAdmins(), cabal.moderation.getMods()]
	  // get all moderation actions issued by our current mods & admins
      const messages = []
      function processMessages (messages) {
        res.info('moderation actions')
        if (messages.length === 0) {
          res.info('no recorded historic moderation actions')
        }
        messages.sort((a, b) => { return a.timestamp - b.timestamp })
        messages.forEach((message) => {
          res.info(message.text)
        })
      }
	  Promise.all(promises).then(results => {
        const keys = results[0].concat(results[1])
        listNextKey()
        function listNextKey () {
          if (keys.length === 0) {
            processMessages(messages)
            return res.end()
          }
          var key = keys.shift()
		  const write = (row, enc, next) => {
            if (!row) return
            const name = cabal.users[key] ? cabal.users[key].name : key.slice(0, 8)
            const target = cabal.users[row.content.id] ? cabal.users[row.content.id].name : row.content.id.slice(0, 8)
            const type = row.type.split('/')[1]
            const reason = row.content.reason
            const role = row.content.flags[0]
            const datestr = strftime('[%F %T] ', new Date(row.timestamp))
            let text, action
            if (['admin', 'mod'].includes(role)) { action = (type === 'add' ? 'added' : 'removed') }
            if (role === 'hide') { action = (type === 'add' ? 'hid' : 'unhid') }
            if (role === 'hide') {
			  text = `${datestr} ${name} ${action} ${target} ${reason}`
            } else {
			  text = `${datestr} ${name} ${action} ${target} as ${role} ${reason}`
            }
            messages.push({ text, timestamp: parseFloat(row.timestamp) })
            next()
		  }
		  const end = (next) => {
            listNextKey()
            next()
          }
		  pump(cabal.core.moderation.listModerationBy(key), to.obj(write, end))
        }
      })
    }
  },
  roles: {
    help: () => 'list all your current moderators and admins',
    call: (cabal, res, arg) => {
	  const promises = [cabal.moderation.getAdmins(), cabal.moderation.getMods()]
	  Promise.all(promises).then(results => {
        const keys = results[0].concat(results[1])
        const print = (type) => {
		  return (k) => {
            res.info(`${cabal.users[k] ? cabal.users[k].name : k.slice(0, 8)}: ${type}`)
		  }
        }
        res.info('moderation roles')
        if (keys.length === 1 && keys[0] === cabal.getLocalUser().key) {
          res.info('you currently have no applied moderators or admins, other than yourself')
          res.info('see /moderation, for how to add some')
          return res.end()
        }
        const printMods = print('moderator')
        const printAdmins = print('admin')
        results[0].map(printAdmins)
        results[1].map(printMods)
        res.end()
	  })
    }
  },
  inspect: {
    help: () => 'view moderation actions published by a user',
    call: (cabal, res, arg) => {
      var args = arg ? arg.split(/\s+/) : []
      if (args.length === 0) {
        res.info('usage: /inspect NICK{.PUBKEY}')
        return res.end()
      }
      var keys = parseNameToKeys(cabal, args[0])
      listNextKey()
      function listNextKey () {
        if (keys.length === 0) return res.end()
        var key = keys.shift()
        res.info(`# moderation for ${getPeerName(cabal, key)}.${key.slice(0, 8)}`)
        pump(cabal.core.moderation.listModerationBy(key), to.obj(write, end))
        function write (row, enc, next) {
          var c = {
            'flags/add': '+',
            'flags/remove': '-',
            'flags/set': '='
          }[row.type] || '?'
          var f = (row.content && row.content.flags || []).join(',')
          var id = row.content && row.content.id || '???'
          res.info(Object.assign({}, row, {
            text: `${c}${f} ${getPeerName(cabal, id)}.${id.slice(0, 8)} ` +
              (row.timestamp ? strftime('[%F %T] ', new Date(row.timestamp)) : '') +
              (row.content && row.content.reason || '')
          }))
          next()
        }
        function end (next) {
          listNextKey()
          next()
        }
      }
    }
  },
  flag: {
    help: () => 'update and read flags set for a given account',
    call: (cabal, res, arg) => {
      var args = arg ? arg.split(/\s+/) : []
      if (args.length === 0) {
        res.info('usage: /flag (add|remove|set) NICK{.PUBKEY} [flags...]')
        res.info('usage: /flag get NICK{.PUBKEY}')
        res.info('usage: /flag list')
        return res.end()
      }
      var channel = '@'
      var cmd = args[0]
      if (/^(add|remove|set)$/.test(cmd)) {
        var keys = parseNameToKeys(cabal, args[1])
        var flags = args.slice(2)
        if (keys.length > 1) {
          res.info('more than one key matches:')
          keys.forEach(key => {
            res.info(`  /flag ${cmd} ${args[1]}.${key} ${flags}`)
          })
          return res.end()
        }
        var id = keys[0]
        cabal.core.moderation[cmd + 'Flags']({ id, channel, flags }, (err) => {
          if (err) res.error(err)
          else res.end()
        })
      } else if (args[0] === 'get') {
        var keys = parseNameToKeys(cabal, args[1])
        var flags = args.slice(2)
        keys.forEach(id => {
          cabal.core.moderation.getFlags({ id, channel }, (err, flags) => {
            if (err) return res.error(err)
            res.info({
              text: `${id}: ` +
                flags.map(flag => /\s/.test(flag) ? JSON.stringify(flag) : flag)
                  .sort().join(' '),
              key: id,
              flags
            })
            res.end()
          })
        })
      } else if (args[0] === 'list') {
        module.exports.flags.call(cabal, res, arg)
      }
    }
  },
  flags: {
    help: () => 'list flags set for accounts',
    call: (cabal, res, arg) => {
      var args = arg ? arg.split(/\s+/) : []
      cabal.core.moderation.list((err, list) => {
        if (err) return res.error(err)
        list.forEach(data => {
          res.info({
            text: JSON.stringify(data),
            data
          })
        })
        res.end()
      })
    }
  }
}

function getNameKeyMatchesFromDetails (details, name) {
  const lastDot = name.lastIndexOf('.')
  const keyPrefix = name.slice(lastDot + 1)
  const namePrefix = name.slice(0, lastDot)
  if (!keyPrefix.length || !namePrefix.length) return []

  const keys = Object.values(details.getUsers())
  return keys
    .filter((u) => u.name.startsWith(namePrefix) && u.key.startsWith(keyPrefix))
    .map(u => u.key)
}

function parseNameToKeys (details, name) {
  if (!name) return null

  const keys = []

  // If it's a 64-character key, use JUST this, since it's umabiguous.
  if (/^[0-9a-f]{64}$/.test(name)) {
    return [name]
  }

  // Is it NAME.KEYPREFIX (with exactly one match)?
  if (/\./.test(name)) {
    const matches = getNameKeyMatchesFromDetails(details, name)
    Array.prototype.push.apply(keys, matches)
  }

  // Is it a name?
  const users = details.getUsers()
  Object.keys(users).forEach(key => {
    if (users[key].name === name) {
      keys.push(key)
    }
  })

  return keys
}

function getPeerName (details, key) {
  const users = details.getUsers()
  if (key in users) {
    return users[key].name || key
  }
  return key
}

function cmpUser (a, b) {
  if (a.online && !b.online) return -1
  if (b.online && !a.online) return 1
  if (a.name && !b.name) return -1
  if (b.name && !a.name) return 1
  if (a.name && b.name) return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1
  return a.key < b.key ? -1 : 1
}

function flagCmd (cmd, cabal, res, arg) {
  var args = arg ? arg.split(/\s+/) : []
  if (args.length === 0) {
    res.info(`usage: /${cmd} NICK{.PUBKEY} {REASON...}`)
    return res.end()
  }
  const channel = '@'
  var id = args[0]
  var keys = parseNameToKeys(cabal, id)
  if (keys.length === 0) {
    res.info(`no matching user found for ${id}`)
    return res.end()
  }
  if (keys.length > 1) {
    res.info('more than one key matches:')
    keys.forEach(key => {
      res.info(`  /${cmd} ${id.split('.')[0]}.${key}`)
    })
    return res.end()
  }
  id = keys[0]
  var type = /^un/.test(cmd) ? 'remove' : 'add'
  var flag = cmd.replace(/^un/, '')
  var reason = args.slice(1).join(' ')
  const reasonstr = reason ? '(reason: ' + reason + ')' : ''
  cabal.moderation.setFlag(flag, type, channel, id, reason).then(() => {
	  if (['admin', 'mod'].includes(flag)) {
      if (/^un/.test(cmd) && flag === 'mod' && !cabal.users[id].isModerator()) {
        res.error(`${getPeerName(cabal, id)} is not a mod`)
      } else if (/^un/.test(cmd) && flag === 'admin' && !cabal.users[id].isAdmin()) {
        res.error(`${getPeerName(cabal, id)} is not an admin`)
      } else if (!/^un/.test(cmd) && flag === 'mod' && cabal.users[id].isModerator()) {
        res.error(`${getPeerName(cabal, id)} is already a mod`)
      } else if (!/^un/.test(cmd) && flag === 'admin' && cabal.users[id].isAdmin()) {
        res.error(`${getPeerName(cabal, id)} is already an admin`)
      }
	  } else {
      if (/^un/.test(cmd)) {
        if (!cabal.users[id].isHidden()) {
          res.error(`cannot unhide ${getPeerName(cabal, id)}: they are not hidden`)
        }
      } else {
        if (cabal.users[id].isHidden()) {
          res.error(`${getPeerName(cabal, id)} is already hidden`)
        }
      }
	  }
    res.end()
  }).catch((err) => { res.error(err) })
}

function listCmd (cmd, cabal, res, arg) {
  var args = arg ? arg.split(/\s+/) : []
  var channel = '@'

  cabal.moderation._listCmd(cmd, channel).then((keys) => {
    if (keys.length === 0) {
      res.info(`you don't have any ${cmd}s`)
      res.end()
      return
    }
    keys.forEach((key) => {
      if (/^[0-9a-f]{64}@\d+$/.test(key)) {
        cabal.core.getMessage(key, function (err, doc) {
          if (err) return res.error(err)
          res.info(Object.assign({}, {
            text: `${cmd}: ${getPeerName(cabal, key)}: ` +
            (doc.timestamp ? strftime(' [%F %T] ', new Date(doc.timestamp)) : '') +
            (doc.content && doc.content.reason || '')
          }))
        })
      } else {
        res.info(Object.assign({}, {
          text: `${cmd}: ${getPeerName(cabal, key)}`
        }))
      }
    })
  })
}

function ucfirst (s) {
  return s.replace(/^[a-z]/, function (c) { return c.toUpperCase() })
}
