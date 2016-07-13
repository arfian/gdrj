package gdrj

import (
	"github.com/eaciit/orm/v1"
)

type MasterArea struct {
	orm.ModelBase `json:"-" bson:"-"`
	ID            string `json:"_id" bson:"_id"` //BrandID
	Name          string
}

func (c *MasterArea) RecordID() interface{} {
	return c.ID
}

func (c *MasterArea) TableName() string {
	return "masterarea"
}

func MasterAreaGetAll() ([]*MasterArea, error) {
	cursor, err := DB().Find(new(MasterArea), nil)
	if err != nil {
		return nil, err
	}

	result := []*MasterArea{}
	err = cursor.Fetch(&result, 0, false)
	if err != nil {
		return nil, err
	}
	cursor.Close()

	return result, nil
}
