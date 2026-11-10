/**
 * Presentation-only guidance. The API remains authoritative for Listing
 * eligibility, required Product Type fields, image counts and approval state.
 */
export interface ListingMediaReadiness {
  imageApplicable: boolean;
  documentApplicable: boolean;
  imageCount: number;
  minimumImages: number;
  maximumImages: number;
  documentCount: number;
  minimumDocuments: number;
  hasPrimaryImage: boolean;
  complete: boolean;
}

export function listingMediaIssues(value: ListingMediaReadiness | null): string[] {
  if (!value) return ['Image and document requirements are still loading.'];
  const issues: string[] = [];
  if (value.imageApplicable) {
    if (value.imageCount < value.minimumImages) {
      issues.push(`Upload at least ${value.minimumImages} product image(s) (${value.imageCount} saved).`);
    }
    if (value.imageCount > value.maximumImages) {
      issues.push(`Remove images above the maximum of ${value.maximumImages}.`);
    }
    if (value.imageCount > 0 && !value.hasPrimaryImage) {
      issues.push('Choose one main product photo.');
    }
  } else if (value.imageCount > 0) {
    issues.push('Images are not applicable to this Product Type.');
  }
  if (value.documentApplicable) {
    if (value.documentCount < value.minimumDocuments) {
      issues.push(`Upload at least ${value.minimumDocuments} required document(s) (${value.documentCount} saved).`);
    }
  } else if (value.documentCount > 0) {
    issues.push('Documents are not applicable to this Product Type.');
  }
  return issues;
}
