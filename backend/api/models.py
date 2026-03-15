import uuid
from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class Client(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    lawyer = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="clients"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class Case(models.Model):

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("disposed", "Disposed"),
        ("dismissed", "Dismissed"),
        ("allowed", "Allowed"),
        ("stay_granted", "Stay Granted"),
        ("withdrawn", "Withdrawn"),
        ("settled", "Settled"),
    ]

    PRIORITY_CHOICES = [
        ("low", "Low"),
        ("normal", "Normal"),
        ("high", "High"),
        ("urgent", "Urgent"),
    ]

    COURT_LEVEL_CHOICES = [
        ("district", "District Court"),
        ("sessions", "Sessions Court"),
        ("high_court", "High Court"),
        ("supreme_court", "Supreme Court"),
        ("tribunal", "Tribunal"),
    ]
    CASE_TYPE_CHOICES = [
        ("criminal", "Criminal"),
        ("civil", "Civil"),
        ("administrative", "Administrative"),
        ("other", "Other"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    client = models.ForeignKey(
        Client,
        on_delete=models.CASCADE,
        related_name="cases"
    )

    case_title = models.CharField(max_length=255)
    case_number = models.CharField(max_length=100, blank=True)
    cnr_number = models.CharField(max_length=100, blank=True)

    case_type = models.CharField(max_length=100, choices=CASE_TYPE_CHOICES, default="other")

    act_name = models.CharField(max_length=255, blank=True)
    primary_section = models.CharField(max_length=255, blank=True)

    filing_date = models.DateField(null=True, blank=True)
    registration_date = models.DateField(null=True, blank=True)

    current_stage = models.CharField(max_length=100, blank=True)

    status = models.CharField(
        max_length=50,
        choices=STATUS_CHOICES,
        default="pending"
    )

    priority_level = models.CharField(
        max_length=50,
        choices=PRIORITY_CHOICES,
        default="normal"
    )

    limitation_end_date = models.DateField(null=True, blank=True)

    court_level = models.CharField(
        max_length=50,
        choices=COURT_LEVEL_CHOICES,
        blank=True
    )

    description = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.case_title

class CaseCourtDetail(models.Model):

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    case = models.ForeignKey(
        Case,
        on_delete=models.CASCADE,
        related_name="court_details"
    )

    court_name = models.CharField(max_length=255)
    court_complex = models.CharField(max_length=255, blank=True)

    judge_name = models.CharField(max_length=255, blank=True)

    bench_type = models.CharField(
        max_length=100,
        blank=True,
        help_text="Single Bench / Division Bench"
    )

    courtroom_number = models.CharField(max_length=50, blank=True)

    state = models.CharField(max_length=100, blank=True)
    district = models.CharField(max_length=100, blank=True)

    def __str__(self):
        return f"{self.case.case_title} - {self.court_name}"

class CaseParty(models.Model):

    PARTY_TYPE_CHOICES = [
        ("plaintiff", "Plaintiff"),
        ("defendant", "Defendant"),
        ("complainant", "Complainant"),
        ("accused", "Accused"),
        ("petitioner", "Petitioner"),
        ("respondent", "Respondent"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    case = models.ForeignKey(
        Case,
        on_delete=models.CASCADE,
        related_name="parties"
    )

    party_name = models.CharField(max_length=255)

    party_type = models.CharField(
        max_length=50,
        choices=PARTY_TYPE_CHOICES
    )

    contact_number = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)

    address = models.TextField(blank=True)

    def __str__(self):
        return f"{self.party_name} ({self.party_type})"

class CaseStatusHistory(models.Model):

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    case = models.ForeignKey(
        Case,
        on_delete=models.CASCADE,
        related_name="status_history"
    )

    status = models.CharField(max_length=100)

    remarks = models.TextField(blank=True)

    updated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True
    )

    updated_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.case.case_title} - {self.status}"

class CaseStage(models.Model):

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    case = models.ForeignKey(
        Case,
        on_delete=models.CASCADE,
        related_name="stages"
    )

    stage_name = models.CharField(max_length=100)

    started_at = models.DateField(null=True, blank=True)
    ended_at = models.DateField(null=True, blank=True)

    notes = models.TextField(blank=True)

    def __str__(self):
        return f"{self.case.case_title} - {self.stage_name}"

class CaseAppeal(models.Model):

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    parent_case = models.ForeignKey(
        Case,
        on_delete=models.CASCADE,
        related_name="appeals"
    )

    appeal_case = models.ForeignKey(
        Case,
        on_delete=models.CASCADE,
        related_name="appeal_of"
    )

    appeal_level = models.CharField(max_length=100)

    filed_on = models.DateField(null=True, blank=True)

    def __str__(self):
        return f"Appeal: {self.parent_case} → {self.appeal_case}"


class CaseFinancialSummary(models.Model):

    case = models.OneToOneField(
        Case,
        on_delete=models.CASCADE,
        related_name="financial_summary"
    )

    total_fee = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_received = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    total_expenses = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    outstanding_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    def __str__(self):
        return f"Financial Summary - {self.case.case_title}"
