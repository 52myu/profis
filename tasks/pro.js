module.exports = function(grunt) {

  'use strict';

  var fs = require('fs'),
    path = require('path');

  var compile_html = function(src, dist, pkg_enable) {

    var path_dist = src + dist,

      map = grunt.file.readJSON(path_dist + "/map.json"),

      res = map['res'],
      pkg = map['pkg'],

      dep_stat = {},

      dep_stat_add = function(dep, name) {
        if (dep_stat[dep] === undefined) {
          dep_stat[dep] = [];
        }
        dep_stat[dep].push(name);
      },

      replace_placeholder = function(name, result) {
        var css = '',
          js = '';

        result['css'].forEach(function(uri) {
          css += '<link href="' + uri + '" rel="stylesheet">\n';
        });

        result['js'].forEach(function(uri) {
          js += '<script src="' + uri + '"></script>\n';
        });

        var html = grunt.file.read(path_dist + name);

        html = html.replace('<!-- [if css placeholder] -->', css)
          .replace('<!-- [if js placeholder] -->', js);

        grunt.file.write(path_dist + name, html);
      };

    for (var key in res) {
      var re = res[key];

      if (re.type === 'ejs' && re.deps) {
        var result = {
          css: [],
          js: [],
          css_pkg: {},
          js_pkg: {}
        };

        re.deps.forEach(function(dep) {
          var res_index = res[dep];
          if (!res_index) {
            grunt.log.error('没有在(' + re.uri + ')中找到依赖(' + dep + ')');
            return false;
          }

          var res_index_pkg = res_index.type + '_pkg';

          dep_stat_add(dep, key);

          if (pkg_enable) {
            if (!result[res_index_pkg][dep]) {
              if (res_index.pkg) {
                var p = pkg[res_index.pkg];

                result[res_index.type].push(p.uri);

                p.has.forEach(function(v) {
                  result[res_index_pkg][v] = true;
                });
              } else {
                result[res_index.type].push(res_index.uri);
                result[res_index_pkg][dep] = true;
              }
            }
          } else {
            result[res_index.type].push(res_index.uri);
            result[res_index_pkg][dep] = true;
          }

        });

        replace_placeholder(re['uri'], result);
      }
    }

    grunt.file.write(path_dist + '/dep_stat.json', JSON.stringify(dep_stat));
  };

  var rmDirSync = function(p) {
    if (!fs.existsSync(p) || !fs.statSync(p).isDirectory()) return;
    var files = fs.readdirSync(p);
    //直接删除空文件夹
    if (!files.length) {
      fs.rmdirSync(p);
      return;
    } else {
      //文件夹不为空，依次删除文件夹下的文件
      files.forEach(function(file) {
        var fullName = path.join(p, file);
        if (fs.statSync(fullName).isDirectory()) {
          rmDirSync(fullName);
        } else {
          fs.unlinkSync(fullName);
        }
      });
    }
    //删除根文件夹
    fs.rmdirSync(p);
  };

  grunt.registerMultiTask('fis', 'fis构建工具', function() {

    var done = this.async();
    var all_command = 'm,D,l,o,p';

    var options = this.options({
      src: './site/',
      dist: '../dist',
      pack: true,
      env: false,
      command: all_command
    });

    var is_clean = grunt.option('clean');
    if (is_clean) {
      rmDirSync(options.src + options.dist);
      grunt.log.success('Successfully clean.');
    }

    grunt.log.subhead('Building...');

    var args = [path.join(__dirname, '../bin/pro'), 'release', '-d', options.dist];

    grunt.util._.forEach(options.command.split(','), function(param) {
      if (all_command.indexOf(param) >= 0) {
        args.push('-' + param);
      }
    });

    if (options.env) {
      grunt.util._.extend(process.env, options.env);
    }

    var child = grunt.util.spawn({
      cmd: 'node',
      args: args,
      opts: {
        cwd: options.src
      }
    }, function(err) {
      if (err) {
        grunt.log.error(err);
        return done(false);
      }

      compile_html(options.src, options.dist, options.pack);

      grunt.log.success('Successfully Builted...');

      done();
    });

    child.stdout.on('data', function(data) {
      grunt.log.write(data);
    });
    child.stderr.on('data', function(data) {
      grunt.log.error(data);
    });
  });

};