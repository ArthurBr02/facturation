<script>
// Root component — just hosts the router outlet. Layout is provided per route
// (AppShell for the authenticated app, full-screen for login/onboarding).
export default {
  name: 'App',
}
</script>

<template>
  <router-view />
</template>
