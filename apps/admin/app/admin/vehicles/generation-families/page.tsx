import { redirect } from 'next/navigation';

export default function ReadOnlyVehicleReferenceRedirect() {
  redirect('/admin/vehicles/configurations');
}
