resource "aws_backup_restore_job" "rds_restore" {
  recovery_point_arn = "arn:aws:backup:ap-northeast-3:123456789012:recovery-point:abcd1234"
  iam_role_arn       = aws_iam_role.backup_role.arn

  metadata = {
    "DBInstanceClass"       = "db.t3.micro"
    "DBSubnetGroupName"     = "my-db-subnet-group"
    "VpcSecurityGroupIds"   = "sg-xxxxxx"
    "MultiAZ"               = "false"
  }

  lifecycle {
    ignore_changes = all
  }
}