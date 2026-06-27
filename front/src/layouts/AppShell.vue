<script>
import SideNav from '@/components/SideNav.vue'

export default {
  name: 'AppShell',
  components: { SideNav },
}
</script>

<template>
  <div class="flex h-full overflow-hidden bg-zinc-50">
    <SideNav />
    <main class="flex-1 flex flex-col overflow-hidden min-w-0">
      <router-view />
    </main>
  </div>
</template>
