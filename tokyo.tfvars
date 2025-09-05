region             = "ap-northeast-1"
name_prefix        = "wp-dev-tokyo"
vpc_id             = "vpc-xxxxxxxx"
public_subnet_ids  = ["subnet-aaa","subnet-bbb"]
private_subnet_ids = ["subnet-ccc","subnet-ddd"]
ami_id             = "ami-tttttttt"     # 東京のゴールデンAMI
db_secret_name     = "/app/dev/db"
