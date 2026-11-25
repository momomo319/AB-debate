'use strict'

const topicHandler = require('./topic-handler');
const postsHandler = require('./posts-handler');
const util = require('./handler-util')

function route(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname

  // テーマ別ディベートページ
  const topicMatch = pathname.match(/^\/topics\/(\d+)$/);
  if (topicMatch) {
    const topicId = Number(topicMatch[1]);
    postsHandler.handleByTopic(req, res, topicId);
    return;
  }

  // テーマごとのA/B投票のエンドポイント
  const voteMatch = pathname.match(/^\/topics\/(\d+)\/vote$/);
  if (voteMatch) {
    const topicId = Number(voteMatch[1]);
    postsHandler.handleVote(req, res, topicId);
    return;
  }

  switch (pathname) {
    case '/':
      util.redirectTo(res, '/topics');
      break;
    case '/topics':
      topicHandler.handle(req, res);
      break;
    case '/topics/delete':
      topicHandler.handleDelete(req, res);
      break;
    case '/posts':
      util.redirectTo(res, '/topics');
      break;
    case '/posts/delete':
      postsHandler.handleDelete(req, res);
      break;
    case '/logout':
      util.handleLogout(req, res);
      break;
    case '/style.css':
      util.handleStyleCssFile(req, res);
      break;
    default:
      util.handleNotFound(req, res);
      break;
  }
}
module.exports = {
  route
};