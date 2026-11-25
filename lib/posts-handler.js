'use strict';

const pug = require('pug');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [ 'query' ] });
const util = require('./handler-util');
const crypto = require('node:crypto');

const oneTimeTokenMap = new Map(); 

// A/Bの集計数・投票者ごとの投票先・ログインユーザの投票先を算出
function summarizeVotes(votes, currentUser) {
  const voteCounts = { A: 0, B: 0 };
  const voteByVoter = {};
  let myVote = null;

  for (const vote of votes) {
    if (vote.choice === 'A') {
      voteCounts.A += 1;
    } else if (vote.choice === 'B') {
      voteCounts.B += 1;
    }
    
    voteByVoter[vote.voterName] = vote.choice;
        
    if (vote.voterName === currentUser) {
      myVote = vote.choice;
    }
  }

  return { voteCounts, voteByVoter, myVote };
}

// テーマ別ディベートページの表示（GET）と投稿作成（POST）を処理
async function handleByTopic(req, res, topicId) {
  if (!Number.isInteger(topicId) || topicId <= 0) {
    util.handleNotFound(req, res);
    return;
  }

  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
  });

  if (!topic) {
    util.handleNotFound(req, res);
    return;
  }

  switch (req.method) {
    case 'GET': 
      const url = new URL(req.url, 'http://localhost');
      const filterParam = url.searchParams.get('filter');
      const sortParam = url.searchParams.get('sort');
      
      const filter = ['all', 'A', 'B'].includes(filterParam) ? filterParam: 'all';
      const sort = sortParam === 'asc' ? 'asc' : 'desc';

      const [posts, votes] = await Promise.all([
        prisma.post.findMany({
          where: { topicId },
          orderBy: { id: sort },
        }),
        prisma.vote.findMany({
          where: { topicId },
        }),
      ]);
      
      const { voteCounts, voteByVoter, myVote } =summarizeVotes(votes, req.user);
      
      const formattedPosts = posts.map((post) => ({
        ...post,
        voterChoice: voteByVoter[post.postedBy] || null,
      }))
      .filter((post) => {
        if (filter === 'A') return post.voterChoice === 'A';
        if (filter === 'B') return post.voterChoice === 'B';
        return true;
      });

      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8'
      });
      
      const oneTimeToken = crypto.randomBytes(8).toString('hex');
      oneTimeTokenMap.set(req.user, oneTimeToken);

      res.end(
        pug.renderFile('./views/posts.pug', {
          topic,
          posts: formattedPosts,
          user: req.user,
          voteCounts,
          myVote,
          filter,
          sort,
          oneTimeToken
        })
      );
      break;

    case 'POST':
      const body = await util.readRequestBody(req);
      const params = new URLSearchParams(body);
      const content = (params.get('content') || '').trim();
      const requestedOneTimeToken = params.get('oneTimeToken');
      const savedToken = oneTimeTokenMap.get(req.user);

      if (!content){
        util.handleBadRequest(req, res);
        return;
      }

      if (!requestedOneTimeToken) {
        util.handleBadRequest(req, res);
        return;
      }
        
      if (savedToken !== requestedOneTimeToken) {
        util.handleBadRequest(req, res);
        return;
      }

      oneTimeTokenMap.delete(req.user);

      await prisma.post.create({
        data: {
          content,
          postedBy: req.user,
          topicId,
        },
      });

      console.log('[POST DEBUG]', {
        user: req.user,
        hasContent: Boolean(content),
        requestedOneTimeToken,
        savedToken,
        mapSize: oneTimeTokenMap.size,
      });
        
      
      util.redirectTo(res, `/topics/${topicId}`)
      break;

    default:
      util.handleBadRequest(req, res)
      break;
  }
}

// 投票処理
async function handleVote(req, res, topicId) {
  if (!Number.isInteger(topicId) || topicId <= 0) {
    util.handleNotFound(req, res);
    return;
  }

  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
  });
  
  if (!topic) {
    util.handleNotFound(req, res);
    return;
  }

  if (req.method !== 'POST') {
    util.handleBadRequest(req, res);
    return;
  }

  const body = await util.readRequestBody(req);
  const params = new URLSearchParams(body);
  const choice = (params.get('choice') || '').trim();

  if (choice !== 'A' && choice !== 'B'){
    util.handleBadRequest(req, res);
    return;
  }

  await prisma.vote.upsert({
    where: {
      topicId_voterName: {
        topicId,
        voterName: req.user,
      },
    },
    update: {
      choice,
    },
    create: {
      topicId,
      voterName: req.user,
      choice,
    },
  });
        
  util.redirectTo(res, `/topics/${topicId}`)
}


// 投稿の削除
async function handleDelete(req, res) {
  if (req.method !== 'POST') {
    util.handleBadRequest(req, res);
    return;
  }

  if (req.user !== 'admin') {
    util.handleBadRequest(req, res);
    return;
  }

  const body = await util.readRequestBody(req)
  const params = new URLSearchParams(body);
  const id = Number(params.get('id'));
        
  if (!Number.isInteger(id) || id <= 0) {
    util.handleBadRequest(req, res);
    return;
  }
        
  const post = await prisma.post.findUnique({
    where: { id }
  });

  if (!post) {
    util.handleNotFound(req, res);
    return;
  }

  await prisma.post.delete({
    where: { id }
  });
  
  util.redirectTo(res, `/topics/${post.topicId}`)
}

module.exports = {
  handleByTopic,
  handleVote,
  handleDelete,
};