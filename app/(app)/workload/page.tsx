import { redirect } from 'next/navigation';

// The Workload tab was merged into "Teams and Workload".
export default function WorkloadPage() { redirect('/teams'); }
