'use strict';
const fs = require('node:fs');

// ログアウト画面を返す
function handleLogout(req, res) {
  res.writeHead(401, {
    'Content-Type': 'text/html; charset=utf-8'
  });
  res.end(
    `<!DOCTYPE html><html lang="ja">
        <body>
            <h1>ログアウトしました</h1>
            <a href="/posts">ログイン</a>
        </body>
    </html>`
  );
}

function handleStyleCssFile(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/css',
  });
  const file = fs.readFileSync('./public/style.css');
  res.end(file);
}

// 404 Not Found レスポンスを返す
function handleNotFound(req, res) {
  res.writeHead(404, {
    'Content-Type': 'text/plain; charset=utf-8'
  });
  res.end('ページが見つかりません');
}

// 400 Bad Request レスポンスを返す
function handleBadRequest(req, res) {
  res.writeHead(400, {
    'Content-Type': 'text/plain; charset=utf-8'
  });
  res.end('未対応のリクエストです');
}

// リクエストボディを文字列として読み取る
function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      }).on('end', () => resolve(body))
        .on('error', (err) => reject(err));
  });
}

// 303 See Other で指定パスへリダイレクトする
function redirectTo(res, location) {
  res.writeHead(303, {
    Location: location,
  });
  res.end();
}

module.exports = {
  handleLogout,
  handleStyleCssFile,
  handleNotFound,
  handleBadRequest,
  readRequestBody,
  redirectTo,
};