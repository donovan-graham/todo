<script lang="ts">
  import { Link } from 'svelte-routing'
  import { useForm } from 'svelte-simple-form'
  import { z } from 'zod'
  import { user } from '../stores/user.svelte'
  import { navigate } from 'svelte-routing'


  import { UserPlus } from 'lucide-svelte'

  const schema = z.object({
    username: z.string().trim().min(3).max(255),
    password: z.string().trim().min(3).max(255)
  })

  type DataType = z.infer<typeof schema>

  const { form, enhance } = useForm<DataType>({
    initialValue: {
      username: '',
      password: ''
    },
    schema,
    onSubmit: async (data) => {
      const body = JSON.stringify({ username: data.username, password: data.password })
      const url = 'http://localhost:3000/api/v1/register'
      try {
        const response = await fetch(url, {
          method: 'POST',
          body,
          headers: {
            'Content-Type': 'application/json'
          },
          mode: 'cors',
          credentials: 'same-origin'
        })

        if (!response.ok) {
          if (response.status === 303) {
            form.setError('username', ['Username already exsist'])
            return
          }
          form.setError('password', ['An errror occured'])
          return
          // throw new Error(`Response status: ${response.status}`);
        }

        const json = await response.json()

        user.authToken = json.token
        navigate('/lists', { replace: true })
      } catch (error) {
        console.error('fetch >>', error.message)
      } finally {
        form.setIsSubmitting(false)
      }
    }
  })
</script>

<form use:enhance id="register-form">
  <h2><UserPlus />Register</h2>

  <label for="register-username">Username</label>
  <fieldset>
    <input
      type="text"
      id="register-username"
      data-testid="register-username"
      name="register-username"
      bind:value={form.data.username}
    />
    {#if form.errors.username?.length}
      <p class="field-error">{form.errors.username.join(', ')}</p>
    {/if}
  </fieldset>

  <label for="register-password">Password</label>
  <fieldset>
    <input
      type="password"
      id="register-password"
      data-testid="register-password"
      name="register-password"
      bind:value={form.data.password}
    />
    {#if form.errors.password?.length}
      <p class="field-error">
        {form.errors.password.join(', ')}
      </p>
    {/if}
  </fieldset>

  <button
    type="submit"
    class="form-button"
    id="register-submit"
    data-testid="register-submit"
    disabled={form.isSubmitting}>Register</button
  >

  <span class="other-links">Already have an account? <Link to="/login">Login</Link></span>
</form>
