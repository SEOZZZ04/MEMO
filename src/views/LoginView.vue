<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '../composables/useAuth'
import { useRouter } from 'vue-router'

const router = useRouter()
const { signInWithEmail, signUpWithEmail } = useAuth()

const email = ref('')
const password = ref('')
const isSignUp = ref(false)
const error = ref<string | null>(null)
const loading = ref(false)

async function handleSubmit() {
  loading.value = true
  error.value = null

  try {
    if (isSignUp.value) {
      await signUpWithEmail(email.value, password.value)
    } else {
      await signInWithEmail(email.value, password.value)
    }
    router.push('/')
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Authentication failed'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <h1 class="login-title">MEMO</h1>
      <p class="login-subtitle">Ontology Knowledge System</p>

      <form @submit.prevent="handleSubmit" class="login-form">
        <input
          v-model="email"
          type="email"
          placeholder="Email"
          required
          class="login-input"
        />
        <input
          v-model="password"
          type="password"
          placeholder="Password"
          required
          minlength="6"
          class="login-input"
        />

        <div v-if="error" class="login-error">{{ error }}</div>

        <button type="submit" class="login-btn" :disabled="loading">
          {{ loading ? '...' : isSignUp ? 'Sign Up' : 'Sign In' }}
        </button>
      </form>

      <button class="toggle-btn" @click="isSignUp = !isSignUp">
        {{ isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background: #F9FAFB;
}

.login-card {
  background: white;
  border: 1px solid #E5E7EB;
  border-radius: 12px;
  padding: 40px;
  width: 100%;
  max-width: 400px;
  text-align: center;
}

.login-title {
  font-size: 2rem;
  font-weight: 800;
  color: #111827;
  margin: 0;
}

.login-subtitle {
  color: #9CA3AF;
  font-size: 0.85rem;
  margin: 4px 0 24px;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.login-input {
  padding: 12px 16px;
  border: 1px solid #D1D5DB;
  border-radius: 8px;
  font-size: 0.95rem;
  outline: none;
}

.login-input:focus {
  border-color: #3B82F6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.login-error {
  color: #EF4444;
  font-size: 0.85rem;
}

.login-btn {
  padding: 12px;
  background: #3B82F6;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
}

.login-btn:hover:not(:disabled) {
  background: #2563EB;
}

.login-btn:disabled {
  opacity: 0.5;
}

.toggle-btn {
  margin-top: 16px;
  background: none;
  border: none;
  color: #3B82F6;
  font-size: 0.85rem;
  cursor: pointer;
}

.toggle-btn:hover {
  text-decoration: underline;
}
</style>
