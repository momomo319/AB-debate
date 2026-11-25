'use strict';

const pug = require('pug');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const util = require('./handler-util');

// テーマ一覧の表示（GET）と新規テーマ作成（POST）を処理
async function handle(req, res) {
  switch (req.method) {
    case 'GET':
      const topics = await prisma.topic.findMany({
        orderBy: {
          id: 'desc'
        },
        include: {
          _count: {
            select: {
              posts: true,
              votes: true,
            },
          },
        },
      });  

      res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8'
      });
      res.end(pug.renderFile('./views/topics.pug', {
         topics, 
         user:req.user,
         })
        );
      break;

    case 'POST':
      const body = await util.readRequestBody(req);
      const params = new URLSearchParams(body);
      const title = (params.get('title') || '').trim();
      const optionA = (params.get('optionA') || '').trim();
      const optionB = (params.get('optionB') || '').trim();
        
      if (!title || !optionA || !optionB) {
        util.handleBadRequest(req, res);
        return;
      }

      await prisma.topic.create({
        data: {
          title,
          optionA,
          optionB,
          createdBy: req.user
        },
      });

      util.redirectTo(res, '/topics');
      break;

    default:
      util.handleBadRequest(req, res)
      break;
  }
}

// テーマ削除
async function handleDelete(req, res) {
  if (req.method !== 'POST') {
    util.handleBadRequest(req, res);
    return;
  }

  if (req.user !== 'admin') {
    util.handleBadRequest(req, res);
    return;
  }

  const body = await util.readRequestBody(req);
  const params = new URLSearchParams(body);
  const id = Number(params.get('id'));
        
  if (!Number.isInteger(id) || id <= 0) {
    util.handleBadRequest(req, res);
    return;
  }

  const topic = await prisma.topic.findUnique({
    where: { id },
  });

  if (!topic) {
    util.handleNotFound(req, res);
    return;
  }

  await prisma.$transaction([
    prisma.vote.deleteMany({ where: { topicId: id } }),
    prisma.post.deleteMany({ where: { topicId: id } }),
    prisma.topic.delete({ where: { id } }),
  ]);

  util.redirectTo(res, '/topics');
  }


module.exports = {
  handle,
  handleDelete,
};