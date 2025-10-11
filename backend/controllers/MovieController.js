const pool = require('../config/database.js')

const apiUrl = 'https://api.themoviedb.org/3/'
const options = {
  method: 'GET',
  headers: {
    accept: 'application/json',
    Authorization: 'Bearer '+process.env.TMDB_TOKEN
  }
}
  
const getImgBaseUrl = async () => {
  try {
    const response = await fetch('https://api.themoviedb.org/3/configuration', options)
    const data = await response.json()
    if(response.status === 200) {
      const imgBaseUrl = data.images.base_url
      return imgBaseUrl
    } else {
      return Error("Couldn't get image base url")
    }
  } catch(err) {
    return err
  }
}

const formatResponse = (raw) => {
  const response = {
    id: parseInt(raw.tmdb_id, 10),
    title: raw.title,
    overview: raw.description,
    poster_url: raw.poster_url,
    release_year: raw.release_year,
    genre: raw.genre,
    vote_average: raw.tmdb_rating
  }
  return response
}

const dbSelect = async (id) => {
  // check if movie exists in database
  try {
    const result = await pool.query('SELECT * FROM movies WHERE tmdb_id=$1;', [id])
    if(result.rows.length === 0) {
      return null
    } else {
      return formatResponse(result.rows[0])
    }
  } catch(err) {
    return err
  }
}

const add = async (req, res, next) => {
  const bodyId = req.body.id
  if(!bodyId) {
    return res.status(400).json({ error: 'body tai id puuttuu'})
  } else {
    const checkId = () => {
      if(((typeof bodyId) === 'number') && Number.isInteger(bodyId)) {
        return bodyId.toString(10)
      } else if(((typeof bodyId) === 'string') && parseInt(bodyId, 10)) {
        return bodyId
      } else {
        return res.status(400).json({ error: 'Huonosti muodostettu id'} )
      }
    }

    const id = checkId()

    // get movie from tmdb if it isn't in the database
    const fetchMovie = async () => {
      try {
        const movieUrl = apiUrl+'movie/'+id+'?language=fi-FI'
        const response = await fetch(movieUrl, options)
        const data = await response.json()
        if(response.status === 200) {
          return data
        } else {
          return Error("Couldn't fetch movie")
        }
      } catch(err) {
        return err
      }
    }

    // add movie to database
    const insertMovie = async () => {
      try {
        const data = await fetchMovie()
        if (data instanceof Error) {
          return data;
        }
        const imgBaseUrl = await getImgBaseUrl()
        if (imgBaseUrl instanceof Error) {
          return imgBaseUrl;
        }
        let genreName = undefined
        if(!data.genres || data.genres.length == 0) {
          genreName = null
        } else {
          genreName = data.genres[0].name
        }
        const result = await pool.query(
          'INSERT INTO movies (tmdb_id, title, description, poster_url, release_year, genre, tmdb_rating)'
          +' VALUES ($1, $2, $3, $4, $5, $6, $7)'
          +' RETURNING *;',
          [
            data.id.toString(), data.title, data.overview, imgBaseUrl+'w185'+data.poster_path,
            data.release_date ? parseInt(data.release_date.slice(0, 4)) : null, genreName, data.vote_average, 
          ]
        )
        if(result.rowCount === 1) {
          return formatResponse(result.rows[0])
        } else {
          return Error("Elokuvaa ei saatu lisättyä tietokantaan")
        }
      } catch(err) {
        return err
      }
    }

    try {
      const dbData = await dbSelect(id)
      if(dbData) {
        return res.status(200).json(dbData)
      } else {
        const insertData = await insertMovie()
        if(insertData && insertData.title) {
          return res.status(201).json(insertData)
        }
        return next(Error("Elokuvaa ei saatu lisättyä"))
      }
    } catch(err) {
      return next(err)
    }
  }
}

const search = async (req, res, next) => {
  try {
    const response = await fetch(
      apiUrl+'search/movie?query='+req.params.query+'&language=fi-FI',
      options
    )
    const data = await response.json()
    if(response.status === 200) {
      return res.status(200).json(data)
    } else {
      return next(Error("TMDB-haku ei onnistunut"))
    }
  } catch(err) {
    return next(err)
  }
}

const getPopular = async (req, res, next) => {
  try {
    const response = await fetch(
      apiUrl + 'movie/popular?language=fi-FI',
      options
    );
    const data = await response.json();
    if (response.status === 200) {
      return res.status(200).json(data);
    } else {
      return next(new Error("TMDB-haku ei onnistunut"));
    }
  } catch (err) {
    return next(err);
  }
};

module.exports = { add, search, getPopular }