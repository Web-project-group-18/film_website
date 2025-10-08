const pool = require('../config/database');
const { getImgBaseUrl } = require('./MovieController.js')

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();


const selectMatchingGroup = async (userId, groupId) => {
  // RETURNS ARRAY OF ZERO OR ONE
  const select = await pool.query(
    "SELECT group_id FROM group_members WHERE status='approved' AND user_id=$1 AND group_id=$2;",
    [userId, groupId]
  )
  return select.rows
}

const createGroup = async (req, res) => {
  try {
    const { group_name } = req.body;
    const owner_id = req.userId;

    if (!group_name || group_name.trim() === '') {
      return res.status(400).json({ error: 'Ryhmän nimi vaaditaan' });
    }

    const existingGroup = await pool.query(
      'SELECT group_id FROM groups WHERE group_name = $1',
      [group_name]
    );
    if (existingGroup.rows.length > 0) {
      return res.status(409).json({ error: 'Samanniminen ryhmä on jo olemassa' });
    }

    const newGroup = await pool.query(
      'INSERT INTO groups (group_name, owner_id) VALUES ($1, $2) RETURNING *',
      [group_name, owner_id]
    );

    // Lisää omistaja automaattisesti jäseneksi
    await pool.query(
      'INSERT INTO group_members (group_id, user_id, status) VALUES ($1, $2, $3)',
      [newGroup.rows[0].group_id, owner_id, 'approved']
    );

    res.status(201).json({ message: 'Ryhmä luotu onnistuneesti', group: newGroup.rows[0] });
  } catch (error) {
    console.error('Ryhmän luontivirhe:', error);
    res.status(500).json({ error: 'Palvelinvirhe ryhmän luonnissa' });
  }
};

const addMovieToGroup = async (req, res, next) => {
  const fetchMovie = async (tmdbId) => {
    // fetch movie from TMDB
    const response = await fetch('https://api.themoviedb.org/3/movies/'+tmdbId+'?language=fi-FI', {
      method: 'GET',
      headers: {
        accept: 'application/json',
        Authorization: 'Bearer '+process.env.TMDB_TOKEN
      }
    })
    if(response.status === 200) {
      return await response.json()
    } else {
      return Error('Elokuvaa ei saatu haettua TMDB:stä')
    }
  }
  const getMovieId = async (tmdbId) => {
    // Check if movie in db. If in db, return id. Else insert it to db and return id.
    const select = await pool.query('SELECT movie_id FROM movies WHERE tmdb_id=$1;', [tmdbId])
    if(select.rows.length === 0) {
      const movie = await fetchMovie()
      const insert = await pool.query(
        'INSERT INTO movies (tmdb_id, title, description, poster_url, release_year, genre, tmdb_rating)'
        +' VALUES ($1, $2, $3, $4, $5, $6, $7)'
        +' RETURNING movie_id;',
        [movie.id, movie.title, movie.overview,
          (await getImgBaseUrl() + movie.poster_path), parseInt(movie.release_date.split(0, 4)),
          movie.genres[0].name, movie.vote_average
        ]
      )
      return insert.rows[0].movie_id
    } else {
      return select.rows[0].movie_id
    }
  }

  const tmdbId = req.body.tmdb_id
  if(!tmdbId) {
    return res.status(400).json({ error: 'ei bodya' })
  } else {
    const userId = req.userId
    const reqGroupId = req.params.id
    try {
      const groupIdArray = await selectMatchingGroup(userId, reqGroupId)
      if(groupIdArray.length === 0) {
        return res.status(403).json({ error: 'Et kuulu tähän ryhmään'})
      } else {
        const groupId = groupIdArray[0].group_id
        const movieId = await getMovieId(tmdbId)
        const insert = await pool.query(
          'INSERT INTO group_movies (group_id, movie_id, added_by_user_id)'
          +' VALUES ($1, $2, $3);',
          [groupId, movieId, userId]
        )
        if(insert.rowCount) {
          return res.status(201).json({ message: 'Elokuva lisätty ryhmään' })
        } else {
          return next(Error("Elokuvaa ei saatu lisättyä ryhmään"))
        }
      }
    } catch(e) {
      if(e.code == 23505) {
        return res.status(200).json({ message: "Elokuva on jo ryhmässä" })
      } else {
        return next(e)
      }
    }
  }
}

const getAllGroups = async (req, res) => {
  try {
    const groups = await pool.query(`
      SELECT 
        g.group_id,
        g.group_name,
        g.owner_id,
        g.created_at,
        u.email as owner_email,
        COUNT(gm.member_id) as member_count
      FROM groups g
      LEFT JOIN users u ON g.owner_id = u.user_id
      LEFT JOIN group_members gm 
        ON g.group_id = gm.group_id AND gm.status = 'approved'
      GROUP BY g.group_id, u.email
      ORDER BY g.created_at DESC
    `);

    res.json({ groups: groups.rows });
  } catch (error) {
    console.error('Ryhmien hakuvirhe:', error);
    res.status(500).json({ error: 'Palvelinvirhe ryhmien haussa' });
  }
};

const getUserGroups = async (req, res) => {
  try {
    const userId = req.userId;

    const groups = await pool.query(`
      SELECT 
        g.group_id,
        g.group_name,
        g.owner_id,
        g.created_at,
        u.email as owner_email,
        CASE WHEN g.owner_id = $1 THEN 'owner' ELSE 'member' END as role
      FROM groups g
      LEFT JOIN users u ON g.owner_id = u.user_id
      LEFT JOIN group_members gm ON g.group_id = gm.group_id
      WHERE (g.owner_id = $1 OR (gm.user_id = $1 AND gm.status = 'approved'))
      GROUP BY g.group_id, u.email
      ORDER BY g.created_at DESC
    `, [userId]);

    res.status(200).json({ groups: groups.rows });
  } catch (error) {
    console.error('Käyttäjän ryhmien hakuvirhe:', error);
    res.status(500).json({ error: 'Palvelinvirhe ryhmien haussa' });
  }
};

const getGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const group = await pool.query(`
      SELECT g.*, u.email as owner_email
      FROM groups g
      LEFT JOIN users u ON g.owner_id = u.user_id
      WHERE g.group_id = $1
    `, [id]);

    if (group.rows.length === 0) {
      return res.status(404).json({ error: 'Ryhmää ei löytynyt' });
    }

    const isMember = await pool.query(`
      SELECT 1 FROM group_members 
      WHERE group_id = $1 AND user_id = $2 AND status = 'approved'
    `, [id, userId]);

    const isOwner = group.rows[0].owner_id === userId;

    if (!isOwner && isMember.rows.length === 0) {
      return res.status(403).json({ error: 'Vain ryhmän jäsenet voivat nähdä ryhmän tiedot' });
    }

    const members = await pool.query(`
      SELECT 
        gm.member_id,
        gm.group_id,
        gm.user_id,
        gm.status,
        gm.joined_at,
        u.email
      FROM group_members gm
      LEFT JOIN users u ON gm.user_id = u.user_id
      WHERE gm.group_id = $1
      ORDER BY gm.status DESC, gm.joined_at DESC
    `, [id]);

    res.json({
      group: group.rows[0],
      members: members.rows,
      userRole: isOwner ? 'owner' : 'member'
    });
  } catch (error) {
    console.error('Ryhmän hakuvirhe:', error);
    res.status(500).json({ error: 'Palvelinvirhe ryhmän haussa' });
  }
};

const getGroupMovies = async (req, res, next) => {
  try {
    const groupIdArray = await selectMatchingGroup(req.userId, req.params.id)
    if(groupIdArray.length === 0) {
      return res.status(403).json({ error: 'Et kuulu tähän ryhmään'})
    } else {
      const groupId = groupIdArray[0].group_id
      const select = await pool.query('SELECT tmdb_id, title, poster_url, release_year'
        +' FROM movies'
        +' INNER JOIN group_movies ON movies.movie_id=group_movies.movie_id'
        +' WHERE group_id=$1;',
        [groupId]
      )
      return res.status(200).json(select.rows)
    }
  } catch(e) {
    return next(e)
  }
}

const deleteGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const group = await pool.query(
      'SELECT * FROM groups WHERE group_id = $1 AND owner_id = $2',
      [id, userId]
    );
    if (group.rows.length === 0) {
      return res.status(403).json({ error: 'Vain ryhmän omistaja voi poistaa ryhmän' });
    }

    await pool.query('DELETE FROM groups WHERE group_id = $1', [id]);
    res.json({ message: 'Ryhmä poistettu onnistuneesti' });
  } catch (error) {
    console.error('Ryhmän poistovirhe:', error);
    res.status(500).json({ error: 'Palvelinvirhe ryhmän poistossa' });
  }
};

// Käyttäjä lähettää liittymispyynnön
const requestJoin = async (req, res) => {
  try {
    const groupId = parseInt(req.params.id, 10);
    const userId = req.userId;

    const g = await pool.query('SELECT owner_id FROM groups WHERE group_id=$1', [groupId]);
    if (g.rowCount === 0) return res.status(404).json({ error: 'Ryhmää ei löytynyt' });
    if (g.rows[0].owner_id === userId) {
      return res.status(400).json({ error: 'Et voi pyytää liittymistä omaan ryhmääsi' });
    }

    const ex = await pool.query(
      'SELECT status FROM group_members WHERE group_id=$1 AND user_id=$2',
      [groupId, userId]
    );
    if (ex.rowCount > 0) {
      const st = ex.rows[0].status;
      if (st === 'approved') return res.status(409).json({ error: 'Olet jo ryhmän jäsen' });
      if (st === 'pending')  return res.status(409).json({ error: 'Sinulla on jo avoin liittymispyyntö' });
    }

    await pool.query(
      'INSERT INTO group_members (group_id, user_id, status) VALUES ($1,$2,$3)',
      [groupId, userId, 'pending']
    );

    res.status(201).json({ message: 'Liittymispyyntö lähetetty' });
  } catch (error) {
    console.error('Liittymispyyntövirhe:', error);
    res.status(500).json({ error: 'Palvelinvirhe liittymispyynnössä' });
  }
};

// Omistaja listaa odottavat pyynnöt
const listJoinRequests = async (req, res) => {
  try {
    const groupId = parseInt(req.params.id, 10);
    const ownerId = req.userId;

    const g = await pool.query('SELECT owner_id FROM groups WHERE group_id=$1', [groupId]);
    if (g.rowCount === 0) return res.status(404).json({ error: 'Ryhmää ei löytynyt' });
    if (g.rows[0].owner_id !== ownerId) {
      return res.status(403).json({ error: 'Vain omistaja voi tarkastella pyyntöjä' });
    }

    const { rows } = await pool.query(
      `SELECT gm.user_id, gm.joined_at, u.email
       FROM group_members gm
       JOIN users u ON u.user_id = gm.user_id
       WHERE gm.group_id=$1 AND gm.status='pending'
       ORDER BY gm.joined_at ASC`,
      [groupId]
    );
    res.json({ requests: rows });
  } catch (error) {
    console.error('Pyyntöjen listausvirhe:', error);
    res.status(500).json({ error: 'Palvelinvirhe pyyntöjen haussa' });
  }
};

// Omistaja HYVÄKSYY liittymispyynnön sähköpostilla
const approveJoinRequest = async (req, res) => {
  const client = await pool.connect();
  try {
    const groupId = parseInt(req.params.id, 10);
    const ownerId = req.userId;
    const emailRaw = req.body?.email;
    if (!emailRaw) return res.status(400).json({ error: 'email vaaditaan bodyssa' });
    const email = normalizeEmail(emailRaw);

    await client.query('BEGIN');

    const g = await client.query('SELECT owner_id FROM groups WHERE group_id=$1', [groupId]);
    if (g.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Ryhmää ei löytynyt' }); }
    if (g.rows[0].owner_id !== ownerId) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Vain omistaja voi hyväksyä pyyntöjä' }); }

    const u = await client.query('SELECT user_id FROM users WHERE LOWER(email)=LOWER($1)', [email]);
    if (u.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Käyttäjää ei löytynyt annetulla sähköpostilla' }); }
    const targetUserId = u.rows[0].user_id;

    const pending = await client.query(
      "SELECT 1 FROM group_members WHERE group_id=$1 AND user_id=$2 AND status='pending'",
      [groupId, targetUserId]
    );
    if (pending.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Liittymispyyntöä ei löytynyt' }); }

    await client.query(
      "UPDATE group_members SET status='approved', joined_at=NOW() WHERE group_id=$1 AND user_id=$2",
      [groupId, targetUserId]
    );

    await client.query('COMMIT');
    res.json({ message: 'Liittymispyyntö hyväksytty' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Pyynnön hyväksyntävirhe:', error);
    res.status(500).json({ error: 'Palvelinvirhe pyynnön hyväksynnässä' });
  } finally {
    client.release();
  }
};

// Omistaja HYLKÄÄ liittymispyynnön sähköpostilla
const rejectJoinRequest = async (req, res) => {
  const client = await pool.connect();
  try {
    const groupId = parseInt(req.params.id, 10);
    const ownerId = req.userId;
    const emailRaw = req.body?.email;
    if (!emailRaw) return res.status(400).json({ error: 'email vaaditaan bodyssa' });
    const email = normalizeEmail(emailRaw);

    await client.query('BEGIN');

    const g = await client.query('SELECT owner_id FROM groups WHERE group_id=$1', [groupId]);
    if (g.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Ryhmää ei löytynyt' }); }
    if (g.rows[0].owner_id !== ownerId) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Vain omistaja voi hylätä pyyntöjä' }); }

    const u = await client.query('SELECT user_id FROM users WHERE LOWER(email)=LOWER($1)', [email]);
    if (u.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Käyttäjää ei löytynyt annetulla sähköpostilla' }); }
    const targetUserId = u.rows[0].user_id;

    const del = await client.query(
      "DELETE FROM group_members WHERE group_id=$1 AND user_id=$2 AND status='pending'",
      [groupId, targetUserId]
    );

    await client.query('COMMIT');

    if (del.rowCount === 0) return res.status(404).json({ error: 'Liittymispyyntöä ei löytynyt' });
    res.json({ message: 'Liittymispyyntö hylätty' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Pyynnön hylkäysvirhe:', error);
    res.status(500).json({ error: 'Palvelinvirhe pyynnön hylkäämisessä' });
  } finally {
    client.release();
  }
};

// Omistaja lisää jäsenen SUORAAN sähköpostilla (ohittaa pendingin)
const addMember = async (req, res) => {
  try {
    const groupId = parseInt(req.params.id, 10);
    const ownerId = req.userId;
    const emailRaw = req.body?.email;

    if (!emailRaw) return res.status(400).json({ error: 'email vaaditaan bodyssa' });
    const email = normalizeEmail(emailRaw);

    const g = await pool.query('SELECT owner_id FROM groups WHERE group_id=$1', [groupId]);
    if (g.rowCount === 0) return res.status(404).json({ error: 'Ryhmää ei löytynyt' });
    if (g.rows[0].owner_id !== ownerId) {
      return res.status(403).json({ error: 'Vain omistaja voi lisätä jäseniä' });
    }

    const u = await pool.query('SELECT user_id FROM users WHERE LOWER(email)=LOWER($1)', [email]);
    if (u.rowCount === 0) return res.status(404).json({ error: 'Käyttäjää ei löytynyt annetulla sähköpostilla' });
    const targetUserId = u.rows[0].user_id;

    const ex = await pool.query(
      'SELECT status FROM group_members WHERE group_id=$1 AND user_id=$2',
      [groupId, targetUserId]
    );

    if (ex.rowCount > 0) {
      const st = ex.rows[0].status;
      if (st === 'approved') return res.status(409).json({ error: 'Käyttäjä on jo jäsen' });
      if (st === 'pending') {
        await pool.query(
          "UPDATE group_members SET status='approved', joined_at=NOW() WHERE group_id=$1 AND user_id=$2",
          [groupId, targetUserId]
        );
        return res.json({ message: 'Käyttäjän pending-pyyntö hyväksyttiin' });
      }
    }

    await pool.query(
      "INSERT INTO group_members (group_id, user_id, status) VALUES ($1,$2,'approved')",
      [groupId, targetUserId]
    );

    res.status(201).json({ message: 'Jäsen lisätty' });
  } catch (error) {
    if (error && error.code === '23505') {
      return res.status(409).json({ error: 'Käyttäjä on jo jäsen/pending' });
    }
    console.error('Jäsenen lisäysvirhe:', error);
    res.status(500).json({ error: 'Palvelinvirhe jäsenen lisäyksessä' });
  }
};

// Omistaja poistaa jäsenen sähköpostilla (poistaa sekä approved että pending)
const removeMember = async (req, res) => {
  try {
    const groupId = parseInt(req.params.id, 10);
    const ownerId = req.userId;
    const emailRaw = req.body?.email;
    if (!emailRaw) return res.status(400).json({ error: 'email vaaditaan bodyssa' });
    const email = normalizeEmail(emailRaw);

    const g = await pool.query('SELECT owner_id FROM groups WHERE group_id=$1', [groupId]);
    if (g.rowCount === 0) return res.status(404).json({ error: 'Ryhmää ei löytynyt' });
    if (g.rows[0].owner_id !== ownerId) {
      return res.status(403).json({ error: 'Vain omistaja voi poistaa jäseniä' });
    }

    const u = await pool.query('SELECT user_id FROM users WHERE LOWER(email)=LOWER($1)', [email]);
    if (u.rowCount === 0) return res.status(404).json({ error: 'Käyttäjää ei löytynyt annetulla sähköpostilla' });
    const targetUserId = u.rows[0].user_id;

    if (targetUserId === ownerId) {
      return res.status(400).json({ error: 'Omistajaa ei voi poistaa. Siirrä omistus tai poista ryhmä.' });
    }

    const del = await pool.query(
      'DELETE FROM group_members WHERE group_id=$1 AND user_id=$2 RETURNING status',
      [groupId, targetUserId]
    );
    if (del.rowCount === 0) {
      return res.status(404).json({ error: 'Käyttäjä ei ole ryhmän jäsen tai pyyntöä ei ole' });
    }

    res.json({ message: 'Jäsen poistettu ryhmästä' });
  } catch (error) {
    console.error('Jäsenen poistovirhe (owner):', error);
    res.status(500).json({ error: 'Palvelinvirhe jäsenen poistossa' });
  }
};

const leaveGroup = async (req, res) => {
  try {
    const groupId = parseInt(req.params.id, 10);
    const userId = req.userId;

    const g = await pool.query('SELECT owner_id FROM groups WHERE group_id=$1', [groupId]);
    if (g.rowCount === 0) return res.status(404).json({ error: 'Ryhmää ei löytynyt' });

    if (g.rows[0].owner_id === userId) {
      return res.status(400).json({ error: 'Omistaja ei voi poistua omasta ryhmästään. Poista ryhmä tai siirrä omistus.' });
    }

    const del = await pool.query(
      'DELETE FROM group_members WHERE group_id=$1 AND user_id=$2 RETURNING status',
      [groupId, userId]
    );
    if (del.rowCount === 0) {
      return res.status(404).json({ error: 'Et ole tämän ryhmän jäsen tai sinulla ei ole pending-pyyntöä' });
    }

    res.json({ message: 'Poistuit ryhmästä' });
  } catch (error) {
    console.error('Ryhmästä poistuminen -virhe:', error);
    res.status(500).json({ error: 'Palvelinvirhe ryhmästä poistuttaessa' });
  }
};

module.exports = {
  createGroup,
  getAllGroups,
  getUserGroups,
  getGroup,
  deleteGroup,
  requestJoin,
  listJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
  addMember,
  removeMember,
  leaveGroup,
  addMovieToGroup,
  getGroupMovies
};


