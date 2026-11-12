<script lang="ts">
	import Header from '#lib/components/Header.svelte';
	import BottomNav, { type TabId } from '#lib/components/BottomNav.svelte';
	import ClockTab from '#lib/components/ClockTab.svelte';
	import HistoryTab from '#lib/components/HistoryTab.svelte';
	import DashboardTab from '#lib/components/DashboardTab.svelte';
	import CalculatorTab from '#lib/components/CalculatorTab.svelte';

	let activeTab = $state<TabId>('clock');
</script>

<svelte:head>
	<title>HourWorked - คำนวณค่าจ้าง & บันทึกเวลาทำงาน</title>
	<meta
		name="description"
		content="เว็บแอปบันทึกเวลาทำงาน คำนวณค่าจ้างรายชั่วโมง กะวันหยุด ภาษีหัก ณ ที่จ่าย และสรุปรายงานสำหรับคนทำงานพาร์ทไทม์ ฟรีแลนซ์ และฟูลไทม์"
	/>
</svelte:head>

<!-- Top Fixed Header -->
<Header onStatusClick={() => (activeTab = 'clock')} />

<!-- Main Content Area with Safe-Area Padding for Mobile Bottom Bar -->
<main class="flex-1 overflow-x-hidden px-4 pb-28 pt-2">
	{#if activeTab === 'clock'}
		<div id="tab-panel-clock" role="tabpanel" aria-labelledby="tab-btn-clock">
			<ClockTab onNavigateToHistory={() => (activeTab = 'history')} />
		</div>
	{:else if activeTab === 'history'}
		<div id="tab-panel-history" role="tabpanel" aria-labelledby="tab-btn-history">
			<HistoryTab />
		</div>
	{:else if activeTab === 'dashboard'}
		<div id="tab-panel-dashboard" role="tabpanel" aria-labelledby="tab-btn-dashboard">
			<DashboardTab
				onNavigateToClock={() => (activeTab = 'clock')}
				onNavigateToConfig={() => (activeTab = 'calculator')}
			/>
		</div>
	{:else if activeTab === 'calculator'}
		<div id="tab-panel-calculator" role="tabpanel" aria-labelledby="tab-btn-calculator">
			<CalculatorTab />
		</div>
	{/if}
</main>

<!-- Bottom Tab Navigation Bar -->
<BottomNav bind:activeTab />
