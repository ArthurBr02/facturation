<script>
// Collapsible sidebar: icon-only by default (54px), expands to 220px on hover.
// Active item highlighted with 2px left border + blue text + light blue bg.
import { useAuthStore } from '@/stores/auth'

const ITEMS = [
  { name: 'dashboard', icon: 'layout-dashboard', label: 'Tableau de bord' },
  { name: 'documents', icon: 'file-text',         label: 'Documents' },
  { name: 'clients',   icon: 'users',              label: 'Clients' },
  { name: 'produits',  icon: 'package',            label: 'Produits & services' },
  { name: 'rapports',  icon: 'bar-chart-2',        label: 'Rapports' },
]

const FOOTER_ITEMS = [
  { name: 'templates', icon: 'file-code',  label: 'Modèles' },
  { name: 'settings',  icon: 'settings',   label: 'Configuration' },
  { name: 'admin',     icon: 'shield',     label: 'Administration' },
]

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

export default {
  name: 'SideNav',
  data() {
    return { hovered: false, items: ITEMS, footerItems: FOOTER_ITEMS }
  },
  computed: {
    user() { return useAuthStore().user },
    userInitials() { return initials(this.user?.nom || this.user?.email || '') },
  },
  mounted() {
    this.$nextTick(() => window.lucide?.createIcons())
  },
  updated() {
    this.$nextTick(() => window.lucide?.createIcons())
  },
  methods: {
    isActive(name) {
      return this.$route.name === name || this.$route.name?.startsWith(name + '-')
    },
  },
}
</script>

<template>
  <aside
    :style="{ width: hovered ? '220px' : '54px' }"
    class="flex-shrink-0 bg-white border-r border-zinc-200 flex flex-col transition-[width] duration-200 overflow-hidden z-20"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
  >
    <!-- Brand -->
    <div class="h-[57px] flex items-center gap-[11px] px-[14px] border-b border-zinc-100 flex-shrink-0">
      <div class="w-[30px] h-[30px] rounded-[6px] bg-zinc-900 text-white flex items-center justify-center font-bold text-[13px] tracking-tight flex-shrink-0">
        AB
      </div>
      <span class="font-bold text-[15px] tracking-tight text-zinc-900 whitespace-nowrap transition-opacity duration-150"
        :style="{ opacity: hovered ? 1 : 0 }">
        Facturation
      </span>
    </div>

    <!-- Primary nav -->
    <nav class="flex flex-col py-[10px] gap-px">
      <router-link
        v-for="item in items"
        :key="item.name"
        :to="{ name: item.name }"
        class="flex items-center gap-[13px] h-[38px] px-[15px] text-[13.5px] transition-colors"
        :class="isActive(item.name)
          ? 'border-l-2 border-blue-600 bg-blue-50 text-blue-600 font-semibold'
          : 'border-l-2 border-transparent text-zinc-600 font-medium hover:bg-zinc-50'"
        :title="!hovered ? item.label : undefined"
      >
        <i :data-lucide="item.icon" width="18" height="18" class="flex-shrink-0"></i>
        <span class="whitespace-nowrap transition-opacity duration-150" :style="{ opacity: hovered ? 1 : 0 }">
          {{ item.label }}
        </span>
      </router-link>
    </nav>

    <!-- Footer nav + user -->
    <div class="mt-auto flex flex-col border-t border-zinc-100 pt-[10px] pb-[10px] gap-px">
      <router-link
        v-for="item in footerItems"
        :key="item.name"
        :to="{ name: item.name }"
        class="flex items-center gap-[13px] h-[38px] px-[15px] text-[13.5px] transition-colors"
        :class="isActive(item.name)
          ? 'border-l-2 border-blue-600 bg-blue-50 text-blue-600 font-semibold'
          : 'border-l-2 border-transparent text-zinc-600 font-medium hover:bg-zinc-50'"
        :title="!hovered ? item.label : undefined"
      >
        <i :data-lucide="item.icon" width="18" height="18" class="flex-shrink-0"></i>
        <span class="whitespace-nowrap transition-opacity duration-150" :style="{ opacity: hovered ? 1 : 0 }">
          {{ item.label }}
        </span>
      </router-link>

      <!-- User avatar -->
      <div class="flex items-center gap-[10px] px-[13px] pt-[11px] mt-1 border-t border-zinc-100">
        <div class="w-[30px] h-[30px] rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-[12px] flex-shrink-0">
          {{ userInitials }}
        </div>
        <div class="overflow-hidden transition-opacity duration-150" :style="{ opacity: hovered ? 1 : 0 }">
          <div class="text-[13px] font-semibold leading-tight text-zinc-900 whitespace-nowrap">{{ user?.nom || user?.email }}</div>
          <div class="text-[11.5px] text-zinc-400 leading-tight whitespace-nowrap">AB Corp</div>
        </div>
      </div>
    </div>
  </aside>
</template>
