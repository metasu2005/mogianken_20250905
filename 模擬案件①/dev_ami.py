import os, boto3, datetime

SRC = "ap-northeast-1"
DST = "ap-northeast-3"
TAG_KEY = os.environ.get("TAG_KEY","Role")
TAG_VAL = os.environ.get("TAG_VAL","golden")
NAME_PREFIX = os.environ.get("NAME_PREFIX","wp-golden")
DST_KMS = os.environ.get("DST_KMS","")  # 必要なときだけ

ec2_src = boto3.client("ec2", region_name=SRC)
ec2_dst = boto3.client("ec2", region_name=DST)

def lambda_handler(event, context):
    # 1) 東京のゴールデンAMIをタグで抽出
    images = ec2_src.describe_images(
        Owners=["self"],
        Filters=[{"Name":f"tag:{TAG_KEY}","Values":[TAG_VAL]}]
    )["Images"]
    if not images:
        print("No golden AMI.")
        return {"copied": False}

    latest = sorted(images, key=lambda i: i["CreationDate"], reverse=True)[0]
    src_ami = latest["ImageId"]

    # 2) 大阪へコピー
    name = f"{NAME_PREFIX}-{datetime.datetime.utcnow():%Y%m%d%H%M}"
    params = {
        "SourceImageId": src_ami,
        "SourceRegion": SRC,
        "Name": name,
        "Encrypted": True if DST_KMS else False
    }
    if DST_KMS:
        params["KmsKeyId"] = DST_KMS

    r = ec2_dst.copy_image(**params)
    dst_ami = r["ImageId"]

    # 3) タグ付与
    tags = latest.get("Tags", []) + [{"Key": "SourceAmi", "Value": src_ami}]
    ec2_dst.create_tags(Resources=[dst_ami], Tags=tags)

    return {"copied": True, "src_ami": src_ami, "dst_ami": dst_ami, "name": name}