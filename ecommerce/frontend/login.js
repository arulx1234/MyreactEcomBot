const form = document.getElementById('loginForm')
const message = document.getElementById('loginMessage')

if (form) {
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const email = document.getElementById('email')?.value?.trim()

    if (!email) {
      message.textContent = 'Please enter your email.'
      message.style.color = '#b91c1c'
      return
    }

    message.textContent = `Welcome back, ${email}! Login ready.`
    message.style.color = '#15803d'
    form.reset()
  })
}
