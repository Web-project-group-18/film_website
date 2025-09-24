require('assert')
const { expect } = require('chai')

describe('Test review browsing', function() {
  const apiUrl = 'http://localhost:3001/api/'
  const authUrl = apiUrl+'auth/'
  const reviewUrl = apiUrl+'reviews/'

  let reviews = []

  async function deleteAccount(token) {
    const response = await fetch(authUrl+'delete-account/', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer '+token }
    })
    const result = await response.json()
    return result.deletedEmail
  }

  function createReview(id, rating, review) {
    return { id, rating, review }
  }
  
  const r0 = createReview(278, 10, 'Shawn shank')
  const r1 = createReview(238, 9, 'Godather. 1972')
  const r2 = createReview(1022256, 8, 'autopiograpi')

  before(async function() {
    async function getToken() {
      const email = 'hf@e.com'
      const password =  'Salasana1'

      async function postOptions(email, password) {
        return {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        }
      }

      async function register(email, password) {
        const response = await fetch(authUrl+'register/', await postOptions(email, password))
        const result = await response.json()
        return result.token
      }

      const loginResponse = await fetch(authUrl+'login/', await postOptions(email, password))
      if(loginResponse.status === 200) {
        const result = await loginResponse.json()
        const deletedEmail = await deleteAccount(result.token)
        return await register(deletedEmail, password)
      } else {
        return await register(email, password)
      }
    }

    const token = await getToken()
    
    async function addReview(review) {
      const movieResponse = await fetch(
        apiUrl+"movies/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: review.id })
        }
      )
      const movieResult = await movieResponse.json()

      const response = await fetch(reviewUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer '+token },
        body: JSON.stringify({ id: movieResult.id, review: review.review, rating: review.rating })
      })
      const result = await response.json()
      return result.id
    }

    return [await addReview(r2), await addReview(r1), await addReview(r0)]
  })


  it('should fetch correct number of reviews', async function() {
    const response = await fetch(reviewUrl)
    const result = reviews = await response.json()
    expect(result).to.have.lengthOf(3)
  })

  it('should have correct id', function() {
    expect(parseInt(reviews[0].tmdb_id)).to.equal(r0.id)
  })

  it('should have correct rating', function() {
    expect(reviews[1].rating).to.equal(r1.rating)
  })
})