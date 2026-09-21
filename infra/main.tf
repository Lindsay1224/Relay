terraform {
  required_providers { google = { source = "hashicorp/google", version = "~> 6.0" } }
}
variable "project_id" { type = string }
variable "region" { type = string default = "us-east4" }
variable "worker_image" { type = string }
provider "google" { project = var.project_id, region = var.region }

locals { services = ["cloudtasks.googleapis.com", "run.googleapis.com", "cloudkms.googleapis.com", "secretmanager.googleapis.com", "gmail.googleapis.com", "aiplatform.googleapis.com", "firestore.googleapis.com"] }
resource "google_project_service" "required" { for_each = toset(local.services); service = each.value; disable_on_destroy = false }
resource "google_service_account" "worker" { account_id = "relay-extraction-worker" }
resource "google_service_account" "tasks" { account_id = "relay-tasks-invoker" }
resource "google_service_account" "app" { account_id = "relay-app-hosting" }
resource "google_cloud_tasks_queue" "gmail" { name = "relay-gmail-extraction" location = var.region rate_limits { max_dispatches_per_second = 3 max_concurrent_dispatches = 3 } retry_config { max_attempts = 8 min_backoff = "5s" max_backoff = "300s" } }
resource "google_kms_key_ring" "relay" { name = "relay" location = var.region }
resource "google_kms_crypto_key" "gmail" { name = "gmail-refresh-token" key_ring = google_kms_key_ring.relay.id rotation_period = "7776000s" lifecycle { prevent_destroy = true } }
resource "google_kms_crypto_key_iam_member" "worker_decrypt" { crypto_key_id = google_kms_crypto_key.gmail.id role = "roles/cloudkms.cryptoKeyDecrypter" member = "serviceAccount:${google_service_account.worker.email}" }
resource "google_kms_crypto_key_iam_member" "app_encrypt" { crypto_key_id = google_kms_crypto_key.gmail.id role = "roles/cloudkms.cryptoKeyEncrypter" member = "serviceAccount:${google_service_account.app.email}" }
resource "google_project_iam_member" "worker_firestore" { project = var.project_id role = "roles/datastore.user" member = "serviceAccount:${google_service_account.worker.email}" }
resource "google_project_iam_member" "app_firestore" { project = var.project_id role = "roles/datastore.user" member = "serviceAccount:${google_service_account.app.email}" }
resource "google_project_iam_member" "app_tasks" { project = var.project_id role = "roles/cloudtasks.enqueuer" member = "serviceAccount:${google_service_account.app.email}" }
resource "google_project_iam_member" "worker_vertex" { project = var.project_id role = "roles/aiplatform.user" member = "serviceAccount:${google_service_account.worker.email}" }
resource "google_cloud_run_v2_service" "worker" { name = "relay-extraction-worker" location = var.region ingress = "INGRESS_TRAFFIC_INTERNAL_ONLY" template { service_account = google_service_account.worker.email containers { image = var.worker_image env { name = "RELAY_TASKS_QUEUE" value = google_cloud_tasks_queue.gmail.name } } } depends_on = [google_project_service.required] }
resource "google_cloud_run_v2_service_iam_member" "tasks_invoker" { name = google_cloud_run_v2_service.worker.name location = var.region role = "roles/run.invoker" member = "serviceAccount:${google_service_account.tasks.email}" }
resource "google_service_account_iam_member" "app_can_mint_tasks_oidc" { service_account_id = google_service_account.tasks.name role = "roles/iam.serviceAccountTokenCreator" member = "serviceAccount:${google_service_account.app.email}" }
output "worker_url" { value = google_cloud_run_v2_service.worker.uri }
