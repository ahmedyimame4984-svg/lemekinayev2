import { redirect } from 'next/navigation';

export default function VehiclesPage() {
  redirect('/admin/vehicles/makes');
}
